import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { findRoleByCodeUseCase } from "./find-role-by-code.use-case.js";
import {
  viewRoleAuditDataBuilder,
  viewRoleUseCase,
} from "./view-role.use-case.js";

vi.mock("./find-role-by-code.use-case.js");

vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

const user = {
  id: "507f1f77bcf86cd799439011",
  idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
  name: "Bob Bill",
  email: "bob.bill@defra.gov.uk",
  idpRoles: ["FCP.Casework.Admin"],
};

const code = "ROLE_RPA_CASES_APPROVE";

describe("viewRoleUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the paged role response", async () => {
    const role = { code, description: "Approve" };

    findRoleByCodeUseCase.mockResolvedValue(role);

    const result = await viewRoleUseCase({ user, code });

    expect(findRoleByCodeUseCase).toHaveBeenCalledWith({ user, code });
    expect(result.data).toEqual(role);
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_ROLE SUCCESS audit event with the role code and actor's context", async () => {
    findRoleByCodeUseCase.mockResolvedValue({ code });

    await viewRoleUseCase({ user, code });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "ROLE", action: "VIEW_ROLE", entityid: code }],
        details: {
          security: {
            actor: {
              id: user.id,
              idpId: user.idpId,
              name: user.name,
              email: user.email,
              idpRoles: user.idpRoles,
            },
          },
        },
        security: { pmccode: "0706" },
        messageGroupId: `view-role-${user.id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the use-case throws", async () => {
    const error = new Error("boom");

    findRoleByCodeUseCase.mockRejectedValue(error);

    await expect(viewRoleUseCase({ user, code })).rejects.toThrow("boom");

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "ROLE", action: "VIEW_ROLE", entityid: code }],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("viewRoleAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const auditData = viewRoleAuditDataBuilder([{ user, code }]);

    const payload = {
      datetime: new Date().toISOString(),
      version: "1.0.0",
      application: "Case Working Service",
      component: "fg-cw-backend",
      environment: "dev",
      correlationid: "11111111-1111-1111-1111-111111111111",
      ip: "10.0.0.1",
      security: auditData.security,
      audit: {
        entities: auditData.entities,
        status: auditStatus.SUCCESS,
        details: auditData.details,
      },
    };

    const { valid } = validateAuditEvent(payload);

    expect(valid).toBe(true);
  });

  it("uses the role code as the entityid", () => {
    const auditData = viewRoleAuditDataBuilder([{ user, code }]);

    expect(auditData.entities[0].entityid).toBe(code);
  });

  it("uses the user id for the messageGroupId", () => {
    const auditData = viewRoleAuditDataBuilder([{ user, code }]);

    expect(auditData.messageGroupId).toBe(`view-role-${user.id}`);
  });

  it("includes a top-level security object for SOC forwarding", () => {
    const auditData = viewRoleAuditDataBuilder([{ user, code }]);

    expect(auditData.security).toEqual({ pmccode: "0706" });
  });
});
