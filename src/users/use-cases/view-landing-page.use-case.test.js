import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { adminAccessCheckUseCase } from "./admin-access-check.use-case.js";
import {
  viewLandingPageAuditDataBuilder,
  viewLandingPageUseCase,
} from "./view-landing-page.use-case.js";

vi.mock("./admin-access-check.use-case.js");

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

const toAuditEvent = (auditData, status) => ({
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
    status,
    details: auditData.details,
  },
});

describe("viewLandingPageUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the paged landing page response", async () => {
    adminAccessCheckUseCase.mockReturnValue({ ok: true });

    const result = await viewLandingPageUseCase({ user });

    expect(adminAccessCheckUseCase).toHaveBeenCalledWith({ user });
    expect(result.data).toEqual({ ok: true });
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_LANDING_PAGE SUCCESS audit event with the actor's context", async () => {
    adminAccessCheckUseCase.mockReturnValue({ ok: true });

    await viewLandingPageUseCase({ user });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "USER", action: "VIEW_LANDING_PAGE" }],
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
        messageGroupId: `view-landing-page-${user.id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the access check throws", async () => {
    adminAccessCheckUseCase.mockImplementation(() => {
      throw new Error("forbidden");
    });

    await expect(viewLandingPageUseCase({ user })).rejects.toThrow("forbidden");

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "USER", action: "VIEW_LANDING_PAGE" }],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("viewLandingPageAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const auditData = viewLandingPageAuditDataBuilder([{ user }]);

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });

  it("uses the user id for the messageGroupId", () => {
    const auditData = viewLandingPageAuditDataBuilder([{ user }]);

    expect(auditData.messageGroupId).toBe(`view-landing-page-${user.id}`);
  });
});
