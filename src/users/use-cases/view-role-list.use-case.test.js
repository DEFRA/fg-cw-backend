import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { findRolesUseCase } from "./find-roles.use-case.js";
import {
  viewRoleListAuditDataBuilder,
  viewRoleListUseCase,
} from "./view-role-list.use-case.js";

vi.mock("./find-roles.use-case.js");

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

describe("viewRoleListUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the paged role list response", async () => {
    const roles = [{ code: "ROLE_1" }];

    findRolesUseCase.mockResolvedValue(roles);

    const result = await viewRoleListUseCase({ user });

    expect(findRolesUseCase).toHaveBeenCalledWith({ user });
    expect(result.data).toEqual(roles);
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_ROLE_LIST SUCCESS audit event with the actor's context", async () => {
    findRolesUseCase.mockResolvedValue([]);

    await viewRoleListUseCase({ user });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "ROLE", action: "VIEW_ROLE_LIST" }],
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
        messageGroupId: `view-role-list-${user.id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the use-case throws", async () => {
    const error = new Error("boom");

    findRolesUseCase.mockRejectedValue(error);

    await expect(viewRoleListUseCase({ user })).rejects.toThrow("boom");

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "ROLE", action: "VIEW_ROLE_LIST" }],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("viewRoleListAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const auditData = viewRoleListAuditDataBuilder([{ user }]);

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

  it("uses the user id for the messageGroupId", () => {
    const auditData = viewRoleListAuditDataBuilder([{ user }]);

    expect(auditData.messageGroupId).toBe(`view-role-list-${user.id}`);
  });

  it("includes a top-level security object for SOC forwarding", () => {
    const auditData = viewRoleListAuditDataBuilder([{ user }]);

    expect(auditData.security).toEqual({ pmccode: "0706" });
  });
});
