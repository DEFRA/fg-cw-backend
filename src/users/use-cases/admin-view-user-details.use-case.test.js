import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { adminFindUserByIdUseCase } from "./admin-find-user-by-id.use-case.js";
import {
  adminViewUserDetailsAuditDataBuilder,
  adminViewUserDetailsUseCase,
} from "./admin-view-user-details.use-case.js";

vi.mock("./admin-find-user-by-id.use-case.js");

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

const userId = "607f1f77bcf86cd799439022";

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

describe("adminViewUserDetailsUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the paged user details response", async () => {
    const foundUser = { id: userId };

    adminFindUserByIdUseCase.mockResolvedValue(foundUser);

    const result = await adminViewUserDetailsUseCase({ user, userId });

    expect(adminFindUserByIdUseCase).toHaveBeenCalledWith({ user, userId });
    expect(result.data).toEqual(foundUser);
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_USER_DETAILS SUCCESS audit event with the target id", async () => {
    adminFindUserByIdUseCase.mockResolvedValue({ id: userId });

    await adminViewUserDetailsUseCase({ user, userId });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          { entity: "USER", action: "VIEW_USER_DETAILS", entityid: userId },
        ],
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
        messageGroupId: `view-user-details-${userId}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the use-case throws", async () => {
    adminFindUserByIdUseCase.mockRejectedValue(new Error("boom"));

    await expect(adminViewUserDetailsUseCase({ user, userId })).rejects.toThrow(
      "boom",
    );

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          { entity: "USER", action: "VIEW_USER_DETAILS", entityid: userId },
        ],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("adminViewUserDetailsAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const auditData = adminViewUserDetailsAuditDataBuilder([{ user, userId }]);

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });

  it("uses the user id for the messageGroupId", () => {
    const auditData = adminViewUserDetailsAuditDataBuilder([{ user, userId }]);

    expect(auditData.messageGroupId).toBe(`view-user-details-${userId}`);
  });
});
