import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { AccessToken } from "../../clients/models/access-token.js";
import { findAll } from "../../clients/repositories/access-token.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { listApiClientsUseCase } from "./list-api-clients.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../clients/repositories/access-token.repository.js");

const CALLER_ID = "6650c1f2a9e4b1d07c20bd91";
const OTHER_ID = "6650c1f2a9e4b1d07c20bd92";
const NAMELESS_ID = "6650c1f2a9e4b1d07c20bd93";
const PAST = new Date("2026-01-01T00:00:00.000Z");
const CREATED = new Date("2026-11-02T10:00:00.000Z");

const listed = (token) => ({
  token,
  stored: { _id: { $oid: token.tokenId }, id: "abc••••••def" },
});

const list = (callerTokenId = CALLER_ID) =>
  listApiClientsUseCase({
    callerTokenId,
    operator: { id: OPERATOR_ID, name: OPERATOR_NAME },
    caller: CASE_READER_CLIENT,
  });

beforeEach(() => {
  withTransaction.mockImplementation(async (run) => run({ id: "session" }));
  writeAuditEvent.mockResolvedValue();
  findAll.mockResolvedValue(
    [
      AccessToken.createMock({
        tokenId: CALLER_ID,
        clientId: CASE_READER_CLIENT,
        tokenHint: "x9Q_",
        createdAt: CREATED,
        createdBy: "Jane",
      }),
      AccessToken.createMock({
        tokenId: OTHER_ID,
        clientId: CASE_READER_CLIENT,
        revokedAt: PAST,
        expiresAt: PAST,
      }),
      AccessToken.createMock({ tokenId: NAMELESS_ID, clientId: "Grants_UI" }),
    ].map(listed),
  );
});

describe("listApiClientsUseCase", () => {
  it("lists every token, nameless ones with no client", async () => {
    const { tokens } = await list();

    expect(tokens.map(({ tokenId, clientId }) => [tokenId, clientId])).toEqual([
      [CALLER_ID, CASE_READER_CLIENT],
      [OTHER_ID, CASE_READER_CLIENT],
      [NAMELESS_ID, null],
    ]);
  });

  it("marks only the caller's own token in use", async () => {
    const { tokens } = await list();

    expect(tokens.map(({ inUse }) => inUse)).toEqual([true, false, false]);
  });

  it("answers every fact of a row as stored, dates as ISO strings", async () => {
    const { tokens } = await list();

    expect(tokens[0]).toEqual({
      tokenId: CALLER_ID,
      clientId: CASE_READER_CLIENT,
      tokenHint: "x9Q_",
      status: "ACTIVE",
      createdAt: CREATED.toISOString(),
      createdBy: "Jane",
      expiresAt: null,
      revokedAt: null,
      revokedBy: null,
      inUse: true,
      stored: { _id: { $oid: CALLER_ID }, id: "abc••••••def" },
    });
    expect(tokens[1]).toMatchObject({
      status: "REVOKED",
      expiresAt: PAST.toISOString(),
      revokedAt: PAST.toISOString(),
    });
  });

  it("derives each row's status with the model's rule when read", async () => {
    findAll.mockResolvedValue(
      [
        AccessToken.createMock({ expiresAt: PAST }),
        AccessToken.createMock({ revokedAt: PAST }),
        AccessToken.createMock({ expiresAt: new Date("2999-01-01T00:00:00Z") }),
      ].map(listed),
    );

    const { tokens } = await list();

    expect(tokens.map(({ status }) => status)).toEqual([
      "EXPIRED",
      "REVOKED",
      "ACTIVE",
    ]);
  });

  it("marks nothing in use for a caller holding none of the rows", async () => {
    const { tokens } = await list("6650c1f2a9e4b1d07c20bd99");

    expect(tokens.every(({ inUse }) => inUse === false)).toBe(true);
  });

  it("audits the read against this service before answering", async () => {
    await list();

    const [[event]] = writeAuditEvent.mock.calls;

    expect(event).toMatchObject({
      status: auditStatus.SUCCESS,
      entities: [
        {
          entity: "API_CLIENT",
          action: "VIEW_API_CLIENT",
          entityid: "fg-cw-backend",
        },
      ],
      details: {
        security: { actor: { id: OPERATOR_ID, name: OPERATOR_NAME } },
        client: { caller: CASE_READER_CLIENT, actor: OPERATOR_NAME },
      },
      security: { pmccode: "0706" },
    });
  });

  it("audits a failed read as a FAILURE", async () => {
    findAll.mockRejectedValue(new Error("down"));

    await expect(list()).rejects.toThrow("down");
    expect(writeAuditEvent.mock.calls[0][0].status).toBe(auditStatus.FAILURE);
  });
});
