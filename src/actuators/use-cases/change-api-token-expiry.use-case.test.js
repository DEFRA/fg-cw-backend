import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { AccessToken } from "../../clients/models/access-token.js";
import {
  findTokenOfClient,
  saveTokenChanges,
} from "../../clients/repositories/access-token.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { changeApiTokenExpiryUseCase } from "./change-api-token-expiry.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../clients/repositories/access-token.repository.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SESSION = { id: "the-transaction" };
const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";
const PAST = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2999-01-01T00:00:00.000Z");
const OPERATOR = { id: OPERATOR_ID, name: OPERATOR_NAME };

const aToken = (facts = {}) =>
  AccessToken.createMock({ tokenId: TOKEN_ID, tokenHint: "x9Q_", ...facts });

const change = (expiresAt, callerTokenId = null) =>
  changeApiTokenExpiryUseCase({
    clientId: "grants-ui",
    tokenId: TOKEN_ID,
    expiresAt,
    callerTokenId,
    operator: OPERATOR,
    caller: CASE_READER_CLIENT,
  });

const auditWritten = () => writeAuditEvent.mock.calls.at(-1);

const errorCodeOf = async (...args) => {
  const error = await change(...args).catch((e) => e);

  return [error.output.statusCode, error.output.payload.errorCode];
};

beforeEach(() => {
  withTransaction.mockImplementation(async (run) => run(SESSION));
  findTokenOfClient.mockResolvedValue(aToken());
  saveTokenChanges.mockResolvedValue(true);
});

describe("changeApiTokenExpiryUseCase", () => {
  it("saves the new expiry onto the row as it was read, answering the updated row", async () => {
    const { token } = await change(LATER);

    expect(saveTokenChanges).toHaveBeenCalledWith(
      {
        clientId: "grants-ui",
        tokenId: TOKEN_ID,
        asRead: { revokedAt: null, expiresAt: null },
        changes: { expiresAt: LATER, revokedAt: null, revokedBy: null },
      },
      SESSION,
    );
    expect(token).toMatchObject({
      tokenId: TOKEN_ID,
      status: "ACTIVE",
      expiresAt: LATER.toISOString(),
    });
  });

  it("revives a revoked token and audits the change, in the transaction", async () => {
    findTokenOfClient.mockResolvedValue(
      aToken({ revokedAt: PAST, revokedBy: "Sam", expiresAt: PAST }),
    );

    const { token, previousExpiresAt, revived } = await change(null);
    const [event, session] = auditWritten();

    expect(previousExpiresAt).toBe(PAST.toISOString());
    expect(revived).toBe(true);

    expect(token).toMatchObject({ status: "ACTIVE", revokedAt: null });
    expect(session).toBe(SESSION);
    expect(event).toMatchObject({
      status: auditStatus.SUCCESS,
      entities: [{ action: "CHANGE_API_TOKEN_EXPIRY", entityid: "grants-ui" }],
      details: {
        client: {
          tokenId: TOKEN_ID,
          expiry: { previous: PAST.toISOString(), next: null, revived: true },
        },
      },
      security: { pmccode: "0705" },
    });
    expect(JSON.stringify(event)).not.toContain("x9Q_");
  });

  it("refuses an expiry that has passed, audited as a FAILURE", async () => {
    expect(await errorCodeOf(PAST)).toEqual([400, "API_TOKEN_INVALID_EXPIRY"]);
    expect(saveTokenChanges).not.toHaveBeenCalled();
    expect(auditWritten()[0].status).toBe(auditStatus.FAILURE);
  });

  it("refuses to end the token the request is made with", async () => {
    expect(await errorCodeOf(PAST, TOKEN_ID)).toEqual([
      409,
      "API_TOKEN_IN_USE",
    ]);
  });

  it("refuses when the row changed before the save landed", async () => {
    saveTokenChanges.mockResolvedValue(false);

    expect(await errorCodeOf(LATER)).toEqual([409, "API_TOKEN_NOT_ACTIVE"]);
  });

  it("answers 404 when the client has no such token", async () => {
    findTokenOfClient.mockResolvedValue(null);

    expect(await errorCodeOf(LATER)).toEqual([404, "API_TOKEN_NOT_FOUND"]);
  });
});
