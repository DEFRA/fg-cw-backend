import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { AccessToken } from "../../clients/models/access-token.js";
import {
  findTokenOfClient,
  insertToken,
  saveTokenChanges,
} from "../../clients/repositories/access-token.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { rotateApiTokenUseCase } from "./rotate-api-token.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../clients/repositories/access-token.repository.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SESSION = { id: "the-transaction" };
const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";
const HASH = "e".repeat(64);
const PAST = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2999-01-01T00:00:00.000Z");
const OPERATOR = { id: OPERATOR_ID, name: OPERATOR_NAME };

const rotate = (keepOld = "24h", callerTokenId = null) =>
  rotateApiTokenUseCase({
    clientId: "grants-ui",
    tokenId: TOKEN_ID,
    tokenHash: HASH,
    tokenHint: "Nw9_",
    keepOld,
    callerTokenId,
    operator: OPERATOR,
    caller: CASE_READER_CLIENT,
  });

const auditWritten = () => writeAuditEvent.mock.calls.at(-1);

const errorCodeOf = async (...args) => {
  const error = await rotate(...args).catch((e) => e);

  return [error.output.statusCode, error.output.payload.errorCode];
};

beforeEach(() => {
  withTransaction.mockImplementation(async (run) => run(SESSION));
  findTokenOfClient.mockResolvedValue(
    AccessToken.createMock({ tokenId: TOKEN_ID, expiresAt: LATER }),
  );
  saveTokenChanges.mockResolvedValue(true);
  insertToken.mockResolvedValue();
});

describe("rotateApiTokenUseCase", () => {
  it("inserts the new token with the old one's expiry, in the transaction", async () => {
    const { token } = await rotate();

    const [[{ token: inserted, hash }, session]] = insertToken.mock.calls;

    expect(hash).toBe(HASH);
    expect(session).toBe(SESSION);
    expect(inserted).toMatchObject({
      clientId: "grants-ui",
      tokenHint: "Nw9_",
      expiresAt: LATER,
      createdBy: OPERATOR_NAME,
    });
    expect(token).toMatchObject({
      tokenId: inserted.tokenId,
      status: "ACTIVE",
      expiresAt: LATER.toISOString(),
      inUse: false,
    });
    expect(JSON.stringify(token)).not.toContain(HASH);
  });

  it("ends the old token after the overlap, onto the row as it was read", async () => {
    const { oldExpiresAt } = await rotate("7d");

    const [[{ asRead, changes }, session]] = saveTokenChanges.mock.calls;

    expect(session).toBe(SESSION);
    expect(asRead).toEqual({ revokedAt: null, expiresAt: LATER });
    expect(changes.expiresAt.getTime() - Date.now()).toBeGreaterThan(
      7 * 24 * 60 * 60 * 1000 - 60_000,
    );
    expect(oldExpiresAt).toBe(changes.expiresAt.toISOString());
  });

  it("audits the rotation with both ids, never the hash or hint", async () => {
    const { token } = await rotate("none");
    const [event, session] = auditWritten();

    expect(session).toBe(SESSION);
    expect(event).toMatchObject({
      status: auditStatus.SUCCESS,
      entities: [{ action: "ROTATE_API_TOKEN", entityid: "grants-ui" }],
      details: {
        client: {
          tokenId: TOKEN_ID,
          rotation: {
            newTokenId: token.tokenId,
            keepOld: "none",
            oldExpiresAt: expect.any(String),
          },
        },
      },
      security: { pmccode: "0705" },
    });
    expect(JSON.stringify(event)).not.toContain(HASH);
    expect(JSON.stringify(event)).not.toContain("Nw9_");
  });

  it("refuses a token that is not active, inserting nothing", async () => {
    findTokenOfClient.mockResolvedValue(
      AccessToken.createMock({
        tokenId: TOKEN_ID,
        revokedAt: PAST,
        expiresAt: PAST,
      }),
    );

    expect(await errorCodeOf()).toEqual([409, "API_TOKEN_NOT_ACTIVE"]);
    expect(insertToken).not.toHaveBeenCalled();
    expect(auditWritten()[0].status).toBe(auditStatus.FAILURE);
  });

  it("refuses, inserting nothing, when the old token changed before the save", async () => {
    saveTokenChanges.mockResolvedValue(false);

    expect(await errorCodeOf()).toEqual([409, "API_TOKEN_NOT_ACTIVE"]);
    expect(insertToken).not.toHaveBeenCalled();
  });

  it("refuses to rotate the request's own token with no overlap", async () => {
    expect(await errorCodeOf("none", TOKEN_ID)).toEqual([
      409,
      "API_TOKEN_IN_USE",
    ]);
  });

  it("rotates the request's own token with an overlap, the new one not in use", async () => {
    const { token } = await rotate("24h", TOKEN_ID);

    expect(token.inUse).toBe(false);
  });
});
