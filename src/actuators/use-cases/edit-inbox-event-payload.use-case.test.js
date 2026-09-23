import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  editPayloadById,
  findEditableById,
} from "../../cases/repositories/inbox.repository.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { editInboxEventPayloadUseCase } from "./edit-inbox-event-payload.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../cases/repositories/inbox.repository.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";
const SESSION = { id: "the-transaction" };
const STORED = { id: "evt-1", data: { amount: "12" } };

const aCommand = (overrides = {}) => ({
  id: ID,
  by: "ada",
  caller: "fg-gas-backend",
  payload: { id: "evt-1", data: { amount: 12 } },
  note: "amount sent as a string",
  revision: 0,
  ...overrides,
});

const A_ROW = { _id: ID, status: "DEAD_LETTER", event: STORED };

const refusedWith = async (command) =>
  editInboxEventPayloadUseCase(command).catch((error) => error.output);

beforeEach(() => {
  withTransaction.mockImplementation(async (run) => run(SESSION));
  findEditableById.mockResolvedValue(A_ROW);
  editPayloadById.mockResolvedValue(true);
});

describe("editInboxEventPayloadUseCase", () => {
  it("edits the inbox row", async () => {
    expect(await editInboxEventPayloadUseCase(aCommand())).toMatchObject({
      payloadRevision: 1,
      changedPaths: ["/data/amount"],
    });
    expect(editPayloadById).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({
        revision: 0,
        original: STORED,
        session: SESSION,
      }),
    );
  });

  it("404s naming the inbox when there is no such row", async () => {
    findEditableById.mockResolvedValue(null);

    const output = await refusedWith(aCommand());

    expect(output.statusCode).toBe(404);
    expect(output.payload.message).toBe(`Inbox event "${ID}" not found`);
  });

  it("audits the edit as an inbox one, in the transaction", async () => {
    await editInboxEventPayloadUseCase(aCommand());

    const [payload, session] = writeAuditEvent.mock.calls[0];

    expect(session).toBe(SESSION);
    expect(payload.details.event).toMatchObject({
      box: "inbox",
      revision: 0,
      changedPaths: ["/data/amount"],
    });
  });
});
