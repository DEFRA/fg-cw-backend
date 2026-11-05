import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { AccessToken } from "../../clients/models/access-token.js";
import {
  findTokenOfClient,
  saveTokenChanges,
} from "../../clients/repositories/access-token.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { logger } from "../../common/logger.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { revokeApiTokenUseCase } from "./revoke-api-token.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../clients/repositories/access-token.repository.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SESSION = { id: "the-transaction" };
const TOKEN_ID = "6650c1f2a9e4b1d07c20bd91";
const OTHER_ID = "6650c1f2a9e4b1d07c20bd92";
const OPERATOR = { id: OPERATOR_ID, name: OPERATOR_NAME };
const LATER = new Date("2099-01-01T00:00:00.000Z");
const PAST = new Date("2026-01-01T00:00:00.000Z");

const aToken = (facts = {}) =>
  AccessToken.createMock({
    tokenId: TOKEN_ID,
    clientId: CASE_READER_CLIENT,
    ...facts,
  });

const revoke = (callerTokenId = OTHER_ID) =>
  revokeApiTokenUseCase({
    clientId: CASE_READER_CLIENT,
    tokenId: TOKEN_ID,
    callerTokenId,
    operator: OPERATOR,
    caller: CASE_READER_CLIENT,
  });

const auditWritten = () => writeAuditEvent.mock.calls.at(-1);

const errorCodeOf = async (callerTokenId) => {
  const error = await revoke(callerTokenId).catch((e) => e);

  return [error.output.statusCode, error.output.payload.errorCode];
};

beforeEach(() => {
  withTransaction.mockImplementation(async (run) => run(SESSION));
  findTokenOfClient.mockResolvedValue(aToken({ expiresAt: LATER }));
  saveTokenChanges.mockResolvedValue(true);
});

describe("revokeApiTokenUseCase", () => {
  it("saves the revocation onto the row as it was read, in the transaction", async () => {
    await revoke();

    expect(findTokenOfClient).toHaveBeenCalledWith(
      CASE_READER_CLIENT,
      TOKEN_ID,
      SESSION,
    );
    expect(saveTokenChanges).toHaveBeenCalledWith(
      {
        clientId: CASE_READER_CLIENT,
        tokenId: TOKEN_ID,
        asRead: { revokedAt: null, expiresAt: LATER },
        changes: {
          revokedAt: expect.any(Date),
          revokedBy: OPERATOR_NAME,
          expiresAt: expect.any(Date),
        },
      },
      SESSION,
    );
  });

  it("audits the revoke in the same transaction", async () => {
    await revoke();

    const [event, session] = auditWritten();

    expect(session).toBe(SESSION);
    expect(event).toMatchObject({
      status: auditStatus.SUCCESS,
      entities: [
        {
          entity: "API_CLIENT",
          action: "REVOKE_API_TOKEN",
          entityid: CASE_READER_CLIENT,
        },
      ],
      details: {
        client: {
          tokenId: TOKEN_ID,
          caller: CASE_READER_CLIENT,
          actor: OPERATOR_NAME,
          errorCode: null,
        },
      },
      security: { pmccode: "0705" },
    });
  });

  it("refuses the token the request is made with, audited outside the transaction", async () => {
    expect(await errorCodeOf(TOKEN_ID)).toEqual([409, "API_TOKEN_IN_USE"]);
    expect(saveTokenChanges).not.toHaveBeenCalled();

    const [event, session] = auditWritten();

    expect(session).toBeNull();
    expect(event.status).toBe(auditStatus.FAILURE);
    expect(event.details.client.errorCode).toBe("API_TOKEN_IN_USE");
  });

  it("refuses a token that is no longer active", async () => {
    findTokenOfClient.mockResolvedValue(
      aToken({ revokedAt: PAST, expiresAt: PAST }),
    );

    expect(await errorCodeOf()).toEqual([409, "API_TOKEN_NOT_ACTIVE"]);
    expect(saveTokenChanges).not.toHaveBeenCalled();
  });

  it("refuses when the row changed before the save landed", async () => {
    saveTokenChanges.mockResolvedValue(false);

    expect(await errorCodeOf()).toEqual([409, "API_TOKEN_NOT_ACTIVE"]);
    expect(auditWritten()[0].status).toBe(auditStatus.FAILURE);
  });

  it("answers 404 for a row stored under a name that fails the rule", async () => {
    findTokenOfClient.mockResolvedValue(
      AccessToken.createMock({ tokenId: TOKEN_ID, clientId: "Grants_UI" }),
    );

    const error = await revokeApiTokenUseCase({
      clientId: "Grants_UI",
      tokenId: TOKEN_ID,
      callerTokenId: OTHER_ID,
      operator: OPERATOR,
      caller: CASE_READER_CLIENT,
    }).catch((e) => e);

    expect(error.output.statusCode).toBe(404);
    expect(error.output.payload.errorCode).toBe("API_TOKEN_NOT_FOUND");
    expect(saveTokenChanges).not.toHaveBeenCalled();
  });

  it("answers 404 when the client has no such token", async () => {
    findTokenOfClient.mockResolvedValue(null);

    expect(await errorCodeOf()).toEqual([404, "API_TOKEN_NOT_FOUND"]);
    expect(saveTokenChanges).not.toHaveBeenCalled();
  });

  it("logs its start and finish", async () => {
    await revoke();

    const action = `Revoking token "${TOKEN_ID}" of API client "${CASE_READER_CLIENT}" for ${OPERATOR_NAME}`;

    expect(logger.info).toHaveBeenCalledWith(action);
    expect(logger.info).toHaveBeenCalledWith(`Finished: ${action}`);
  });
});
