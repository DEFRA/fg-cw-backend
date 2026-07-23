import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { User } from "../../users/models/user.js";
import { Case } from "../models/case.js";
import { Position } from "../models/position.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { insertMany } from "../repositories/outbox.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import {
  updateStageOutcomeAuditDataBuilder,
  updateStageOutcomeUseCase,
} from "./update-stage-outcome.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("../repositories/outbox.repository.js");
vi.mock("../../common/with-transaction.js");
vi.mock("./ensure-case-position.use-case.js");
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

describe("updateStageOutcomeUseCase audit", () => {
  const mockUser = User.createMock();

  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
    insertMany.mockResolvedValue(undefined);
    withTransaction.mockImplementation(async (cb) => cb({}));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes an UPDATE_STAGE_OUTCOME audit event on success", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();
    mockWorkflow.validateStageActionComment = vi.fn();
    mockWorkflow.getNextPosition = vi.fn().mockReturnValue(
      new Position({
        phaseCode: "PHASE_1",
        stageCode: "STAGE_2",
        statusCode: "STATUS_1",
      }),
    );
    mockCase.updateStageOutcome = vi.fn();
    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);
    update.mockResolvedValue(mockCase);

    await updateStageOutcomeUseCase({
      caseId: mockCase._id,
      actionCode: "APPROVE",
      comment: "approved",
      user: mockUser,
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "CASE",
            action: "UPDATE_STAGE_OUTCOME",
            entityid: mockCase._id,
          },
        ],
        security: { pmccode: "0706" },
        messageGroupId: `update-stage-outcome-${mockCase._id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the case is not found", async () => {
    findById.mockResolvedValue(null);

    await updateStageOutcomeUseCase({
      caseId: "missing",
      actionCode: "APPROVE",
      user: mockUser,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
  });

  it("produces a payload that passes audit validation", () => {
    const auditData = updateStageOutcomeAuditDataBuilder([
      { caseId: "abc", actionCode: "APPROVE", comment: "c", user: mockUser },
    ]);

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });
});
