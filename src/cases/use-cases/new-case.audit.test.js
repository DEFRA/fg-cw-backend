import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";
import {
  newCaseAuditDataBuilder,
  newCaseUseCase,
} from "./new-case.use-case.js";

vi.mock("../repositories/outbox.repository.js");
vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflow-by-code.use-case.js");
vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

const toAuditEvent = (auditData, status) => ({
  datetime: new Date().toISOString(),
  version: "1.0.0",
  application: "Case Working Service",
  component: "fg-cw-backend",
  environment: "test",
  correlationid: "test-correlation-id",
  ip: "10.0.0.1",
  security: auditData.security,
  audit: {
    entities: auditData.entities,
    status,
    details: auditData.details,
  },
});

const message = {
  event: {
    data: {
      workflowCode: "workflow-code",
      caseRef: "TEST-001",
      payload: {
        createdAt: "2025-01-01T00:00:00.000Z",
        submittedAt: "2025-01-01T00:00:00.000Z",
        identifiers: {},
        answers: {},
      },
    },
  },
};

describe("newCaseUseCase audit", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes a CREATE_CASE audit event within the transaction session on success", async () => {
    const session = { id: "session-1" };
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });
    findWorkflowByCodeUseCase.mockResolvedValue(Workflow.createMock());

    await newCaseUseCase(message, session);

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "CASE",
            action: "CREATE_CASE",
            entityid: "TEST-001",
          },
        ],
        security: { pmccode: "0706" },
        messageGroupId: "create-case-TEST-001",
        status: auditStatus.SUCCESS,
      }),
      session,
    );
    expect(writeAuditEvent.mock.calls[0][0].details.security.actor.id).toBe(
      "fg-gas-backend",
    );
  });

  it("writes a FAILURE audit event when workflow lookup fails", async () => {
    findWorkflowByCodeUseCase.mockRejectedValue(new Error("boom"));

    await newCaseUseCase(message, { id: "session-1" }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
  });

  it("produces a payload that passes audit validation", () => {
    const auditData = newCaseAuditDataBuilder(
      [message],
      new ObjectId("888888888888888999999998"),
    );

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });
});
