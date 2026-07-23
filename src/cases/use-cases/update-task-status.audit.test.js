import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import {
  updateTaskStatusAuditDataBuilder,
  updateTaskStatusUseCase,
} from "./update-task-status.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
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

describe("updateTaskStatusUseCase audit", () => {
  const userId = new ObjectId().toHexString();
  const mockUser = User.createMock({
    id: userId,
    idpRoles: [IdpRoles.ReadWrite],
  });

  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes an UPDATE_TASK_STATUS audit event on success", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();
    mockCase.setTaskStatus = vi.fn();
    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);
    update.mockResolvedValue(mockCase);

    await updateTaskStatusUseCase({
      caseId: mockCase._id,
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      status: "STATUS_OPTION_1",
      comment: "done",
      user: mockUser,
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "CASE",
            action: "UPDATE_TASK_STATUS",
            entityid: mockCase._id,
          },
        ],
        security: { pmccode: "0706" },
        messageGroupId: `update-task-status-${mockCase._id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
    expect(writeAuditEvent.mock.calls[0][0].details.security.actor.id).toBe(
      userId,
    );
  });

  it("writes a FAILURE audit event when the case is not found", async () => {
    findByCode.mockResolvedValue(Workflow.createMock());
    findById.mockResolvedValue(null);

    await updateTaskStatusUseCase({
      caseId: "missing",
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      status: "COMPLETE",
      user: mockUser,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
  });

  it("produces a payload that passes audit validation", () => {
    const auditData = updateTaskStatusAuditDataBuilder([
      {
        caseId: "abc",
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        status: "COMPLETE",
        completed: true,
        user: mockUser,
      },
    ]);

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });
});
