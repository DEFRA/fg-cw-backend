import { beforeEach, describe, expect, it, vi } from "vitest";
import { caseCreate } from "../cases/events/inbound-event-types.js";
import { Case } from "../cases/models/case.js";
import { Workflow } from "../cases/models/workflow.js";
import { findById, update } from "../cases/repositories/case.repository.js";
import {
  findByMessageId,
  insertOne,
} from "../cases/repositories/inbox.repository.js";
import { insertMany } from "../cases/repositories/outbox.repository.js";
import { resolveWorkflowForCase } from "../cases/use-cases/resolve-current-workflow.use-case.js";
import { saveConfigVersionInboxMessageUseCase } from "../cases/use-cases/save-config-version-inbox-message.use-case.js";
import { saveInboxMessageUseCase } from "../cases/use-cases/save-inbox-message.use-case.js";
import { updateStageOutcomeUseCase } from "../cases/use-cases/update-stage-outcome.use-case.js";
import { withTransaction } from "../common/with-transaction.js";
import { writeAuditEvent } from "../common/write-audit-event.js";
import { User } from "../users/models/user.js";

vi.mock("@defra/fcp-audit-publisher", () => ({
  validateAuditEvent: vi.fn(() => ({ valid: true })),
}));
vi.mock("../cases/repositories/case.repository.js");
vi.mock("../cases/repositories/inbox.repository.js");
vi.mock("../cases/repositories/outbox.repository.js");
vi.mock("../cases/use-cases/ensure-case-position.use-case.js");
vi.mock("../cases/use-cases/resolve-current-workflow.use-case.js");
vi.mock("../common/with-transaction.js");

const insertedOutboxRow = (call) => insertMany.mock.calls[call][0][0];

describe("every insert into the outbox", () => {
  beforeEach(() => {
    insertMany.mockResolvedValue(undefined);
  });

  it("stamps a published event", async () => {
    const kase = Case.createMock({
      caseRef: "ABC-123",
      workflowCode: "example-workflow",
    });
    const workflow = Workflow.createMock();
    workflow.validateStageActionComment = vi.fn();
    workflow.getNextPosition = vi.fn().mockReturnValue(kase.position);
    kase.updateStageOutcome = vi.fn();
    withTransaction.mockImplementation((callback) => callback({}));
    findById.mockResolvedValue(kase);
    update.mockResolvedValue(kase);
    resolveWorkflowForCase.mockResolvedValue({
      workflow,
      resolvedVersion: null,
    });

    await updateStageOutcomeUseCase({
      caseId: kase._id,
      actionCode: "APPROVE",
      user: User.createMock(),
    });

    const row = insertedOutboxRow(0);

    expect(row.toDocument()).toMatchObject({
      eventType: "CaseStatusUpdated",
      refs: expect.arrayContaining(["ref:abc-123", `id:${row.event.id}`]),
    });
  });

  it("stamps an audit event", async () => {
    await writeAuditEvent({
      entities: [{ entity: "CASE", action: "VIEW_CASE", entityid: "ABC-123" }],
      status: "SUCCESS",
    });

    expect(insertedOutboxRow(0).toDocument()).toMatchObject({
      eventType: "Audit",
      refs: [expect.stringMatching(/^trace:/)],
    });
  });
});

describe("every insert into the inbox", () => {
  beforeEach(() => {
    findByMessageId.mockResolvedValue(null);
  });

  const insertedInboxRow = () => insertOne.mock.calls[0][0].toDocument();

  it("stamps a received message", async () => {
    await saveInboxMessageUseCase({
      message: {
        id: "0b7c1d1e-0000-4000-8000-000000000001",
        type: caseCreate.sentAs,
        time: "2026-06-16T10:00:00.000Z",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        data: {
          caseRef: "ABC-124",
          previousCaseRef: "ABC-123",
          workflowCode: "example-workflow",
        },
      },
      source: "GAS",
    });

    expect(insertedInboxRow()).toMatchObject({
      eventType: "CreateCase",
      refs: [
        "ref:abc-124",
        "case:example-workflow:~41.~42.~43.-124",
        "ref:abc-123",
        "case:example-workflow:~41.~42.~43.-123",
        "id:0b7c1d1e-0000-4000-8000-000000000001",
        "trace:4bf92f3577b34da6a3ce929d0e0e4736",
      ],
    });
    expect(insertedInboxRow()).not.toHaveProperty("kind");
  });

  it("stamps a config version message", async () => {
    await saveConfigVersionInboxMessageUseCase(
      [],
      { grant: { DataType: "String", StringValue: "example-workflow" } },
      { messageId: "0b7c1d1e-0000-4000-8000-000000000002" },
    );

    expect(insertedInboxRow()).toMatchObject({
      eventType: "ConfigVersionUpdated",
      refs: ["id:0b7c1d1e-0000-4000-8000-000000000002"],
    });
  });

  it("stamps a message nobody declared as unrecognised", async () => {
    await saveInboxMessageUseCase({
      message: {
        id: "0b7c1d1e-0000-4000-8000-000000000003",
        type: "io.example.unknown",
        time: "2026-06-16T10:00:00.000Z",
        data: { caseRef: "ABC-123", workflowCode: "example-workflow" },
      },
      source: "GAS",
    });

    expect(insertedInboxRow()).toMatchObject({
      eventType: "Unrecognised",
      refs: ["id:0b7c1d1e-0000-4000-8000-000000000003"],
    });
  });
});
