import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { createCaseWorkflowContext } from "../../common/build-view-model.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { externalActionUseCase } from "./external-action.use-case.js";
import {
  performPageActionAuditDataBuilder,
  performPageActionUseCase,
} from "./perform-page-action.use-case.js";

vi.mock("../../common/build-view-model.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("./external-action.use-case.js");
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

describe("performPageActionUseCase audit", () => {
  const mockUser = User.createMock({
    id: "user-123",
    idpRoles: [IdpRoles.ReadWrite],
  });

  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
    createCaseWorkflowContext.mockReturnValue({});
    externalActionUseCase.mockResolvedValue({});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes a PERFORM_PAGE_ACTION audit event on success", async () => {
    findById.mockResolvedValue({ _id: "case-1", workflowCode: "FRPS" });
    findByCode.mockResolvedValue({
      requiredRoles: { allOf: [], anyOf: [] },
      findExternalAction: vi.fn().mockReturnValue({
        code: "ACT",
        name: "Act",
        display: false,
        target: null,
      }),
    });

    await performPageActionUseCase({
      caseId: "case-1",
      actionCode: "ACT",
      user: mockUser,
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "CASE",
            action: "PERFORM_PAGE_ACTION",
            entityid: "case-1",
          },
        ],
        security: { pmccode: "0706" },
        messageGroupId: "perform-page-action-case-1",
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
    expect(writeAuditEvent.mock.calls[0][0].details.action.actionCode).toBe(
      "ACT",
    );
  });

  it("writes a FAILURE audit event when the case is not found", async () => {
    findById.mockResolvedValue(null);

    await performPageActionUseCase({
      caseId: "missing",
      actionCode: "ACT",
      user: mockUser,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
  });

  it("produces a payload that passes audit validation", () => {
    const auditData = performPageActionAuditDataBuilder([
      { caseId: "abc", actionCode: "ACT", user: mockUser },
    ]);

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });
});
