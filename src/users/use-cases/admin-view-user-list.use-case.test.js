import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { adminFindUsersUseCase } from "./admin-find-users.use-case.js";
import {
  adminViewUserListAuditDataBuilder,
  adminViewUserListUseCase,
} from "./admin-view-user-list.use-case.js";

vi.mock("./admin-find-users.use-case.js");

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

describe("adminViewUserListUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the paged user list response", async () => {
    const users = [{ id: "user-1" }];
    const query = { ids: [], allAppRoles: [], anyAppRoles: [] };

    adminFindUsersUseCase.mockResolvedValue(users);

    const result = await adminViewUserListUseCase({ user, query });

    expect(adminFindUsersUseCase).toHaveBeenCalledWith({ user, query });
    expect(result.data).toEqual(users);
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_USER_LIST SUCCESS audit event with the actor's context", async () => {
    adminFindUsersUseCase.mockResolvedValue([]);

    await adminViewUserListUseCase({ user, query: {} });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "USER", action: "VIEW_USER_LIST" }],
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
        segregationRef: `view-user-list-${user.id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the use-case throws", async () => {
    adminFindUsersUseCase.mockRejectedValue(new Error("boom"));

    await expect(adminViewUserListUseCase({ user, query: {} })).rejects.toThrow(
      "boom",
    );

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "USER", action: "VIEW_USER_LIST" }],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("adminViewUserListAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const auditData = adminViewUserListAuditDataBuilder([{ user }]);

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });

  it("uses the user id for the segregationRef", () => {
    const auditData = adminViewUserListAuditDataBuilder([{ user }]);

    expect(auditData.segregationRef).toBe(`view-user-list-${user.id}`);
  });
});
