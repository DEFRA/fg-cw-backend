import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { Case } from "../models/case.js";
import { WorkflowPhase } from "../models/workflow-phase.js";
import { WorkflowStageStatus } from "../models/workflow-stage-status.js";
import { WorkflowStage } from "../models/workflow-stage.js";
import { WorkflowTaskGroup } from "../models/workflow-task-group.js";
import { WorkflowTask } from "../models/workflow-task.js";
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

  const createInputTask = (input) => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock({
      phases: [
        new WorkflowPhase({
          code: "PHASE_1",
          name: "Phase 1",
          stages: [
            new WorkflowStage({
              code: "STAGE_1",
              name: "Stage 1",
              description: "Stage description",
              statuses: [
                new WorkflowStageStatus({
                  code: "STATUS_1",
                  name: "Interactive Status",
                  theme: "INFO",
                  description: "Status description",
                  interactive: true,
                  transitions: [],
                }),
              ],
              taskGroups: [
                new WorkflowTaskGroup({
                  code: "TASK_GROUP_1",
                  name: "Task Group 1",
                  description: "Task group description",
                  tasks: [
                    new WorkflowTask({
                      code: "TASK_1",
                      name: "Task 1",
                      mandatory: true,
                      description: "Task description",
                      input,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    kase.workflowCode = workflow.code;
    kase.setTaskValue = vi.fn();

    findById.mockResolvedValue(kase);
    findByCode.mockResolvedValue(workflow);
    update.mockResolvedValue(kase);

    return kase;
  };

  it("audits the derived value and completed flag, not the command values", async () => {
    const kase = createInputTask({ type: "text", label: "Reference" });

    await updateTaskStatusUseCase({
      caseId: kase._id,
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: "  hello  ",
      completed: false,
      user: mockUser,
    });

    expect(writeAuditEvent.mock.calls[0][0].details.task).toEqual({
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: "hello",
      completed: true,
    });
  });

  it("writes an UPDATE_TASK_STATUS audit event on success", async () => {
    const mockCase = Case.createMock();
    const mockWorkflow = Workflow.createMock();
    mockCase.setTaskValue = vi.fn();
    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);
    update.mockResolvedValue(mockCase);

    await updateTaskStatusUseCase({
      caseId: mockCase._id,
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: "STATUS_OPTION_1",
      comment: "done",
      user: mockUser,
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "CASE",
            action: "UPDATE_TASK_STATUS",
            entityid: mockCase.caseRef,
          },
        ],
        security: { pmccode: "0706" },
        segregationRef: `update-task-value-${mockCase._id}`,
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
      value: "COMPLETE",
      user: mockUser,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
    // No use case result to derive from, so the audit records what was asked for.
    expect(writeAuditEvent.mock.calls[0][0].details.task).toEqual({
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: "COMPLETE",
      completed: undefined,
    });
  });

  it("produces a payload that passes audit validation", () => {
    const auditData = updateTaskStatusAuditDataBuilder(
      [
        {
          caseId: "abc",
          taskGroupCode: "TASK_GROUP_1",
          taskCode: "TASK_1",
          user: mockUser,
        },
      ],
      { value: "COMPLETE", completed: true },
    );

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });
});
