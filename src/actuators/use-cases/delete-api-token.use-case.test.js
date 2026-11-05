import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { AccessToken } from "../../clients/models/access-token.js";
import {
  deleteInactiveToken,
  findTokenOfClient,
} from "../../clients/repositories/access-token.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { deleteApiTokenUseCase } from "./delete-api-token.use-case.js";

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

const revoked = () =>
  AccessToken.createMock({
    tokenId: TOKEN_ID,
    revokedAt: PAST,
    expiresAt: PAST,
  });

const remove = () =>
  deleteApiTokenUseCase({
    clientId: "grants-ui",
    tokenId: TOKEN_ID,
    operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
    caller: CASE_READER_CLIENT,
  });

const errorCodeOf = async () => {
  const error = await remove().catch((e) => e);

  return [error.output.statusCode, error.output.payload.errorCode];
};

beforeEach(() => {
  withTransaction.mockImplementation(async (run) => run(SESSION));
  findTokenOfClient.mockResolvedValue(revoked());
  deleteInactiveToken.mockResolvedValue(true);
});

describe("deleteApiTokenUseCase", () => {
  it.each([
    ["revoked", { revokedAt: PAST, expiresAt: PAST }],
    ["expired", { expiresAt: PAST }],
  ])("deletes a %s token, in the transaction", async (_, facts) => {
    findTokenOfClient.mockResolvedValue(
      AccessToken.createMock({ tokenId: TOKEN_ID, ...facts }),
    );

    await remove();

    expect(deleteInactiveToken).toHaveBeenCalledWith(
      { clientId: "grants-ui", tokenId: TOKEN_ID, now: expect.any(Date) },
      SESSION,
    );
  });

  it("audits the token id only, in the same transaction", async () => {
    await remove();

    const [event, session] = writeAuditEvent.mock.calls.at(-1);

    expect(session).toBe(SESSION);
    expect(event).toMatchObject({
      status: auditStatus.SUCCESS,
      entities: [{ action: "DELETE_API_TOKEN", entityid: "grants-ui" }],
      details: { client: { tokenId: TOKEN_ID } },
      security: { pmccode: "0705" },
    });
  });

  it("refuses an active token, deleting nothing, audited as a FAILURE", async () => {
    findTokenOfClient.mockResolvedValue(
      AccessToken.createMock({ tokenId: TOKEN_ID }),
    );

    expect(await errorCodeOf()).toEqual([409, "API_TOKEN_ACTIVE"]);
    expect(deleteInactiveToken).not.toHaveBeenCalled();
    expect(writeAuditEvent.mock.calls.at(-1)[0].status).toBe(
      auditStatus.FAILURE,
    );
  });

  it("refuses a token revived before the delete landed", async () => {
    findTokenOfClient
      .mockResolvedValueOnce(revoked())
      .mockResolvedValueOnce(AccessToken.createMock({ tokenId: TOKEN_ID }));
    deleteInactiveToken.mockResolvedValue(false);

    expect(await errorCodeOf()).toEqual([409, "API_TOKEN_ACTIVE"]);
  });

  it("answers 404 for a token deleted before the delete landed", async () => {
    findTokenOfClient
      .mockResolvedValueOnce(revoked())
      .mockResolvedValueOnce(null);
    deleteInactiveToken.mockResolvedValue(false);

    expect(await errorCodeOf()).toEqual([404, "API_TOKEN_NOT_FOUND"]);
  });

  it.each([
    ["an unknown token", null],
    [
      "a row whose stored name fails the rule",
      AccessToken.createMock({ tokenId: TOKEN_ID, clientId: "Grants_UI" }),
    ],
  ])("answers 404 for %s", async (_, row) => {
    findTokenOfClient.mockResolvedValue(row);

    expect(await errorCodeOf()).toEqual([404, "API_TOKEN_NOT_FOUND"]);
  });
});
