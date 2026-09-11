import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findStatusById,
  redriveById,
} from "../repositories/inbox.repository.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { redriveInboxEventUseCase } from "./redrive-inbox-event.use-case.js";

vi.mock("../../common/mongo-client.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../repositories/inbox.repository.js");

const ID = "665f1c2e9a1b2c3d4e5f6a7b";

// The session `withTransaction` hands a real caller. Everything that has to
// join the transaction is asserted against this exact object.
const SESSION = { id: "the-transaction" };

beforeEach(() => {
  withTransaction.mockImplementation(async (run) => run(SESSION));
});

const aDoc = () => ({
  _id: new ObjectId(ID),
  messageId: "evt-1",
  type: "cloud.defra.prd.fg-gas-backend.case.create.new",
  status: "RESUBMITTED",
  completionAttempts: 0,
});

describe("redriveInboxEventUseCase", () => {
  it("issues the conditional update by id", async () => {
    redriveById.mockResolvedValue(aDoc());

    await redriveInboxEventUseCase({ id: ID });

    expect(redriveById).toHaveBeenCalledWith(ID, {
      by: undefined,
      session: SESSION,
    });
  });

  it("returns the updated list row", async () => {
    redriveById.mockResolvedValue(aDoc());

    expect(await redriveInboxEventUseCase({ id: ID })).toMatchObject({
      _id: ID,
      status: "RESUBMITTED",
      completionAttempts: 0,
    });
  });

  it("stamps maxAttempts on the returned row", async () => {
    redriveById.mockResolvedValue(aDoc());

    expect((await redriveInboxEventUseCase({ id: ID })).maxAttempts).toBe(5);
  });

  it("does not read the status again on the happy path", async () => {
    redriveById.mockResolvedValue(aDoc());

    await redriveInboxEventUseCase({ id: ID });

    expect(findStatusById).not.toHaveBeenCalled();
  });

  it("404s when the conditional update matched nothing and the row is gone", async () => {
    redriveById.mockResolvedValue(null);
    findStatusById.mockResolvedValue(null);

    await expect(redriveInboxEventUseCase({ id: ID })).rejects.toMatchObject({
      output: { statusCode: 404 },
    });
  });

  it("409s when the row is no longer DEAD_LETTER", async () => {
    redriveById.mockResolvedValue(null);
    findStatusById.mockResolvedValue("COMPLETED");

    await expect(redriveInboxEventUseCase({ id: ID })).rejects.toMatchObject({
      output: { statusCode: 409 },
    });
  });

  it("puts the current status in the 409 body", async () => {
    redriveById.mockResolvedValue(null);
    findStatusById.mockResolvedValue("PUBLISHED");

    await expect(redriveInboxEventUseCase({ id: ID })).rejects.toMatchObject({
      output: { payload: { statusCode: 409, status: "PUBLISHED" } },
    });
  });

  // the race: the row was DEAD_LETTER when the page rendered, but something
  // else moved it before the update landed. The update matches nothing, so
  // nothing is clobbered and the caller is told what it is now.
  it("loses cleanly to a concurrent state change", async () => {
    redriveById.mockResolvedValue(null);
    findStatusById.mockResolvedValue("PROCESSING");

    await expect(redriveInboxEventUseCase({ id: ID })).rejects.toMatchObject({
      output: { payload: { status: "PROCESSING" } },
    });
    expect(redriveById).toHaveBeenCalledTimes(1);
  });
});

describe("redriveInboxEventUseCase actor", () => {
  it("passes the actor through to the conditional update", async () => {
    redriveById.mockResolvedValue(aDoc());

    await redriveInboxEventUseCase({ id: ID, by: "donatas" });

    expect(redriveById).toHaveBeenCalledWith(ID, {
      by: "donatas",
      session: SESSION,
    });
  });
});

// This service audits its own state change, and the row and that record commit
// together or not at all.
describe("redriveInboxEventUseCase transaction", () => {
  it("runs the redrive and its audit inside one transaction", async () => {
    redriveById.mockResolvedValue(aDoc());

    await redriveInboxEventUseCase({ id: ID, by: "donatas", caller: "gas" });

    expect(withTransaction).toHaveBeenCalledTimes(1);
    // The same session reaches the row update and the audit's outbox insert -
    // which is what makes them one commit.
    expect(redriveById).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ session: SESSION }),
    );
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SUCCESS" }),
      SESSION,
    );
  });

  it("records the redrive against the event, naming actor and caller", async () => {
    redriveById.mockResolvedValue(aDoc());

    await redriveInboxEventUseCase({ id: ID, by: "donatas", caller: "gas" });

    const [payload] = writeAuditEvent.mock.calls[0];

    expect(payload.entities).toEqual([
      { entity: "EVENT", action: "REDRIVE_EVENT", entityid: ID },
    ]);
    expect(payload.details.event).toEqual({
      box: "inbox",
      actor: "donatas",
      caller: "gas",
    });
    expect(payload.segregationRef).toBe(`redrive-event-${ID}`);
  });

  // "System" is GAS's display wording; storage keeps the absence.
  it("records an unattributed redrive as a null actor", async () => {
    redriveById.mockResolvedValue(aDoc());

    await redriveInboxEventUseCase({ id: ID, by: null, caller: "gas" });

    const [payload] = writeAuditEvent.mock.calls[0];

    expect(payload.details.event.actor).toBeNull();
    expect(JSON.stringify(payload)).not.toContain("System");
  });

  // A swallowed audit failure would leave the row redriven with nothing
  // recording it. Rethrowing aborts the transaction instead.
  it("fails the redrive when the audit event cannot be written", async () => {
    redriveById.mockResolvedValue(aDoc());
    writeAuditEvent.mockRejectedValue(new Error("outbox insert failed"));

    await expect(
      redriveInboxEventUseCase({ id: ID, caller: "gas" }),
    ).rejects.toThrow("outbox insert failed");
  });

  it("fails the redrive when the audit payload will not validate", async () => {
    redriveById.mockResolvedValue(aDoc());
    writeAuditEvent.mockRejectedValue(
      new Error("Audit event failed validation"),
    );

    await expect(
      redriveInboxEventUseCase({ id: ID, caller: "gas" }),
    ).rejects.toThrow("Audit event failed validation");
  });

  // The abort is the transaction's job, so what this pins is that the error
  // escapes the callback - the only way a real transaction rolls the row back.
  it("lets the audit failure escape the transaction callback", async () => {
    redriveById.mockResolvedValue(aDoc());
    writeAuditEvent.mockRejectedValue(new Error("outbox insert failed"));

    let escaped = null;
    withTransaction.mockImplementation(async (run) => {
      try {
        return await run(SESSION);
      } catch (error) {
        escaped = error;
        throw error;
      }
    });

    await expect(
      redriveInboxEventUseCase({ id: ID, caller: "gas" }),
    ).rejects.toThrow("outbox insert failed");
    expect(escaped).toBeInstanceOf(Error);
  });
});
