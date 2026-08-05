import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { WorkflowEndpoint } from "../models/workflow-endpoint.js";
import { save } from "../repositories/workflow.repository.js";
import {
  createWorkflowAuditDataBuilder,
  createWorkflowUseCase,
} from "./create-workflow.use-case.js";

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

const buildValidWorkflowCommand = (user) => ({
  user,
  code: "wf-001",
  version: 1,
  pages: {
    cases: {
      details: {
        banner: { summary: {} },
        tabs: { caseDetails: { title: "Test", sections: [] } },
      },
    },
  },
  phases: [
    {
      code: "PHASE_1",
      name: "Phase 1",
      stages: [
        {
          code: "STAGE_1",
          name: "Stage 1",
          description: "Stage 1",
          statuses: [
            {
              code: "STATUS_1",
              name: "Status 1",
              description: "Status 1",
              closes: true,
              transitions: [
                {
                  targetPosition: "PHASE_1:STAGE_1:STATUS_1",
                  action: {
                    code: "APPROVE",
                    name: "Approve",
                    checkTasks: true,
                    comment: {
                      label: "Approval Comment",
                      helpText: "Please provide approval details",
                      mandatory: true,
                    },
                  },
                },
                {
                  targetPosition: "PHASE_1:STAGE_1:STATUS_1",
                },
              ],
            },
          ],
          taskGroups: [
            {
              code: "TASK_GROUP_1",
              name: "Task Group 1",
              description: "Task group 1",
              tasks: [
                {
                  code: "TASK_1",
                  name: "Task 1",
                  mandatory: true,
                  description: "Task 1",
                  requiredRoles: null,
                  valueOptions: [
                    {
                      code: "COMPLETE",
                      name: "Complete",
                      theme: "SUCCESS",
                      completes: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  requiredRoles: {
    allOf: ["ROLE_1", "ROLE_2"],
    anyOf: ["ROLE_3"],
  },
  definitions: {
    key1: "value1",
  },
  endpoints: [WorkflowEndpoint.createMock()],
  externalActions: [],
});

describe("createWorkflowUseCase audit", () => {
  const adminUser = User.createMock({
    id: "admin-user",
    idpRoles: [IdpRoles.Admin],
  });

  const nonAdminUser = User.createMock({
    id: "readwrite-user",
    idpRoles: [IdpRoles.ReadWrite],
  });

  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
    save.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes a CREATE_WORKFLOW SUCCESS audit event with the actor's context", async () => {
    await createWorkflowUseCase(buildValidWorkflowCommand(adminUser));

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "WORKFLOW",
            action: "CREATE_WORKFLOW",
            entityid: "wf-001",
          },
        ],
        security: { pmccode: "0706" },
        segregationRef: "create-workflow-wf-001",
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );

    const auditArg = writeAuditEvent.mock.calls[0][0];
    expect(auditArg.details.security.actor.id).toBe("admin-user");
    expect(auditArg.details.workflow).toEqual({ code: "wf-001", version: 1 });
  });

  it("writes a FAILURE audit event when the user is not authorised", async () => {
    await createWorkflowUseCase({
      code: "wf-001",
      version: 1,
      user: nonAdminUser,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "WORKFLOW",
            action: "CREATE_WORKFLOW",
            entityid: "wf-001",
          },
        ],
        status: auditStatus.FAILURE,
      }),
      null,
    );
    expect(save).not.toHaveBeenCalled();
  });
});

describe("createWorkflowAuditDataBuilder", () => {
  const user = User.createMock({
    id: "admin-user",
    idpRoles: [IdpRoles.Admin],
  });

  it("produces a payload that passes audit validation", () => {
    const auditData = createWorkflowAuditDataBuilder(
      [{ code: "wf-001", version: 1, user }],
      { code: "wf-001", version: 1 },
    );

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });

  it("groups outbox rows by workflow code via segregationRef", () => {
    const auditData = createWorkflowAuditDataBuilder(
      [{ code: "wf-001", version: 1, user }],
      undefined,
    );

    expect(auditData.segregationRef).toBe("create-workflow-wf-001");
  });

  it("falls back to the command code for entityid when there is no result", () => {
    const auditData = createWorkflowAuditDataBuilder(
      [{ code: "wf-001", version: 1, user }],
      undefined,
    );

    expect(auditData.entities[0].entityid).toBe("wf-001");
  });

  it("sets no messageGroupId", () => {
    const auditData = createWorkflowAuditDataBuilder(
      [{ code: "wf-001", version: 1, user }],
      undefined,
    );

    expect(auditData).not.toHaveProperty("messageGroupId");
  });
});
