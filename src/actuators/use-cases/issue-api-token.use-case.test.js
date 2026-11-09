import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { AccessToken } from "../../clients/models/access-token.js";
import {
  findByClient,
  insertToken,
} from "../../clients/repositories/access-token.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { logger } from "../../common/logger.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { withErrorCode } from "../../common/with-error-code.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { issueApiTokenUseCase } from "./issue-api-token.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../clients/repositories/access-token.repository.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const SESSION = { id: "the-transaction" };
const HASH = "e".repeat(64);
const OPERATOR = { id: OPERATOR_ID, name: OPERATOR_NAME };

const issue = (overrides = {}) =>
  issueApiTokenUseCase({
    clientId: "grants-ui",
    tokenHash: HASH,
    tokenHint: "x9Q_",
    newClient: false,
    operator: OPERATOR,
    caller: CASE_READER_CLIENT,
    ...overrides,
  });

const auditWritten = () => writeAuditEvent.mock.calls.at(-1);

const everythingLogged = () =>
  JSON.stringify([
    logger.info.mock.calls,
    logger.warn.mock.calls,
    logger.error.mock.calls,
  ]);

beforeEach(() => {
  withTransaction.mockImplementation(async (run) => run(SESSION));
  findByClient.mockResolvedValue([AccessToken.createMock()]);
  insertToken.mockResolvedValue();
});

describe("issueApiTokenUseCase", () => {
  it("stores the new token with its hash, in the transaction", async () => {
    await issue();

    expect(findByClient).toHaveBeenCalledWith("grants-ui", SESSION);

    const [[{ token, hash }, session]] = insertToken.mock.calls;

    expect(hash).toBe(HASH);
    expect(session).toBe(SESSION);
    expect(token).toMatchObject({
      clientId: "grants-ui",
      tokenHint: "x9Q_",
      createdBy: OPERATOR_NAME,
      createdAt: expect.any(Date),
    });
  });

  it("answers with the new token's row and never its hash", async () => {
    const result = await issue();

    expect(result).toEqual({
      token: {
        tokenId: expect.stringMatching(/^[0-9a-f]{24}$/),
        clientId: "grants-ui",
        tokenHint: "x9Q_",
        status: "ACTIVE",
        createdAt: expect.any(String),
        createdBy: OPERATOR_NAME,
        expiresAt: null,
        revokedAt: null,
        revokedBy: null,
        inUse: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain(HASH);
  });

  it("issues beside any number of active tokens", async () => {
    findByClient.mockResolvedValue([
      AccessToken.createMock(),
      AccessToken.createMock(),
      AccessToken.createMock(),
    ]);

    await expect(issue()).resolves.toBeDefined();
  });

  it("audits the issue with the token id, in the same transaction", async () => {
    findByClient.mockResolvedValue([]);

    const { token } = await issue({ newClient: true, clientId: "new-one" });
    const [event, session] = auditWritten();

    expect(session).toBe(SESSION);
    expect(event).toMatchObject({
      status: auditStatus.SUCCESS,
      entities: [
        {
          entity: "API_CLIENT",
          action: "ISSUE_API_TOKEN",
          entityid: "new-one",
        },
      ],
      details: {
        security: { actor: { id: OPERATOR_ID, name: OPERATOR_NAME } },
        client: {
          tokenId: token.tokenId,
          newClient: true,
          caller: CASE_READER_CLIENT,
          actor: OPERATOR_NAME,
          errorCode: null,
        },
      },
      security: { pmccode: "0705" },
    });
  });

  it("logs its start and finish, never the hash", async () => {
    await issue();

    expect(logger.info).toHaveBeenCalledWith(
      `Issuing a token to API client "grants-ui" for ${OPERATOR_NAME}`,
    );
    expect(logger.info).toHaveBeenCalledWith(
      `Finished: Issuing a token to API client "grants-ui" for ${OPERATOR_NAME}`,
    );
    expect(everythingLogged()).not.toContain(HASH);
    expect(JSON.stringify(writeAuditEvent.mock.calls)).not.toContain(HASH);
  });

  it.each([
    [
      "creating a client that exists",
      () => {},
      { newClient: true },
      [409, "API_CLIENT_EXISTS"],
    ],
    [
      "a client with no rows",
      () => findByClient.mockResolvedValue([]),
      {},
      [404, "API_CLIENT_NOT_FOUND"],
    ],
    [
      "a malformed hash",
      () => {},
      { tokenHash: "nope" },
      [400, "API_TOKEN_INVALID_HASH"],
    ],
    [
      "a name that fails the rule",
      () => findByClient.mockResolvedValue([]),
      { clientId: "Bad_Name", newClient: true },
      [400, "API_CLIENT_INVALID_NAME"],
    ],
    [
      "a missing hint",
      () => {},
      { tokenHint: undefined },
      [400, "API_TOKEN_INVALID_HINT"],
    ],
    [
      "a malformed hint",
      () => {},
      { tokenHint: "x9Q" },
      [400, "API_TOKEN_INVALID_HINT"],
    ],
  ])(
    "refuses %s, writes nothing and audits a FAILURE outside the transaction",
    async (_, arrange, overrides, [statusCode, errorCode]) => {
      arrange();

      const refusal = await issue(overrides).catch((error) => error);

      expect(refusal.output.statusCode).toBe(statusCode);
      expect(refusal.output.payload.errorCode).toBe(errorCode);
      expect(insertToken).not.toHaveBeenCalled();

      const [event, session] = auditWritten();

      expect(session).toBeNull();
      expect(event.status).toBe(auditStatus.FAILURE);
      expect(event.details.client.errorCode).toBe(errorCode);
      expect(event.details.client.tokenId).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        `Refused: Issuing a token to API client "${overrides.clientId ?? "grants-ui"}" for ${OPERATOR_NAME} - ${errorCode}`,
      );
    },
  );

  it("audits a duplicate hash by its code alone, never the Mongo message", async () => {
    const duplicate = withErrorCode(
      Boom.conflict("A token with this hash already exists"),
      "API_TOKEN_DUPLICATE",
    );
    insertToken.mockRejectedValue(duplicate);

    await expect(issue()).rejects.toBe(duplicate);

    const [event] = auditWritten();

    expect(event.status).toBe(auditStatus.FAILURE);
    expect(event.details.client.errorCode).toBe("API_TOKEN_DUPLICATE");
    expect(JSON.stringify(event)).not.toContain(HASH);
  });
});
