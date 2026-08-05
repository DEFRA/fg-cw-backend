import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { AppRole } from "../../users/models/app-role.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import {
  assignUserToCaseAuditDataBuilder,
  assignUserToCaseUseCase,
} from "./assign-user-to-case.use-case.js";
import { resolveWorkflowForCase } from "./resolve-current-workflow.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../../users/use-cases/find-user-by-id.use-case.js");
vi.mock("./resolve-current-workflow.use-case.js");
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

const buildAssignee = () =>
  User.createMock({
    id: new ObjectId().toHexString(),
    appRoles: {
      ROLE_1: new AppRole({
        name: "ROLE_1",
        startDate: "1960-01-01",
        endDate: "2100-01-01",
      }),
      ROLE_2: new AppRole({
        name: "ROLE_2",
        startDate: "1960-01-01",
        endDate: "2100-01-01",
      }),
      ROLE_3: new AppRole({
        name: "ROLE_3",
        startDate: "1960-01-01",
        endDate: "2100-01-01",
      }),
    },
  });

describe("assignUserToCaseUseCase audit", () => {
  const actorId = new ObjectId().toHexString();
  const actor = User.createMock({
    id: actorId,
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: {
      ROLE_1: new AppRole({
        name: "ROLE_1",
        startDate: "1960-01-01",
        endDate: "2100-01-01",
      }),
      ROLE_2: new AppRole({
        name: "ROLE_2",
        startDate: "1960-01-01",
        endDate: "2100-01-01",
      }),
      ROLE_3: new AppRole({
        name: "ROLE_3",
        startDate: "1960-01-01",
        endDate: "2100-01-01",
      }),
    },
  });

  const mockWorkflow = Workflow.createMock({
    requiredRoles: {
      allOf: ["ROLE_1", "ROLE_2"],
      anyOf: ["ROLE_3"],
    },
  });

  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
    resolveWorkflowForCase.mockResolvedValue({
      workflow: mockWorkflow,
      resolvedVersion: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes an ASSIGN_USER_TO_CASE audit event with the assignee's details", async () => {
    const mockCase = Case.createMock();
    mockCase.assignUser = vi.fn();
    const assignee = buildAssignee();

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(assignee);
    update.mockResolvedValue(mockCase);

    await assignUserToCaseUseCase({
      caseId: mockCase._id,
      assignedUserId: assignee.id,
      notes: "assigning",
      user: actor,
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "CASE",
            action: "ASSIGN_USER_TO_CASE",
            entityid: mockCase.caseRef,
          },
        ],
        security: { pmccode: "0706" },
        segregationRef: `assign-user-to-case-${mockCase._id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );

    const auditArg = writeAuditEvent.mock.calls[0][0];
    expect(auditArg.details.security.actor.id).toBe(actorId);
    expect(auditArg.details.security.targetUser.id).toBe(assignee.id);
    expect(auditArg.details.security.targetUser.appRoles).toBeDefined();
    expect(auditArg.details.assignedUserId).toBe(assignee.id);
  });

  it("writes a FAILURE audit event when the case is not found", async () => {
    findById.mockResolvedValue(null);

    await assignUserToCaseUseCase({
      caseId: "missing",
      assignedUserId: new ObjectId().toHexString(),
      notes: "assigning",
      user: actor,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
    const auditArg = writeAuditEvent.mock.calls[0][0];
    expect(auditArg.details.security.targetUser).toBeUndefined();
  });

  it("produces a payload that passes audit validation", () => {
    const assignee = buildAssignee();

    const auditData = assignUserToCaseAuditDataBuilder(
      [
        {
          caseId: "abc",
          caseRef: "case-ref",
          assignedUserId: assignee.id,
          user: actor,
        },
      ],
      { assignedUser: assignee },
    );

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });
});
