import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../models/idp-roles.js";
import { User } from "../models/user.js";
import { findById } from "../repositories/user.repository.js";
import {
  updateUserAuditDataBuilder,
  updateUserUseCase,
} from "./update-user.use-case.js";

vi.mock("../repositories/user.repository.js");
vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

const toPayload = (auditData, status = auditStatus.SUCCESS) => ({
  correlationid: "correlation-1",
  datetime: new Date().toISOString(),
  environment: "test",
  version: "1.0.0",
  application: "Case Working Service",
  component: "fg-cw-backend",
  ip: "1.2.3.4",
  security: auditData.security,
  audit: {
    entities: auditData.entities,
    status,
    details: auditData.details,
  },
});

describe("updateUserUseCase auditing", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("captures before/after roles and target user when admin edits another user", async () => {
    const userId = "user-123";
    const target = User.createMock({
      id: userId,
      idpRoles: [IdpRoles.Read],
      appRoles: {},
    });
    findById.mockResolvedValue(target);

    await updateUserUseCase({
      authenticatedUser: { id: "admin-user", idpRoles: [IdpRoles.Admin] },
      userId,
      props: {
        idpRoles: [IdpRoles.Admin],
        appRoles: {
          ROLE_NEW: { startDate: "2025-07-01", endDate: "2025-08-02" },
        },
      },
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "USER", action: "UPDATE_USER", entityid: userId }],
        details: expect.objectContaining({
          security: expect.objectContaining({
            actor: expect.objectContaining({ id: "admin-user" }),
            targetUser: expect.objectContaining({ id: userId }),
          }),
          changes: {
            idpRoles: {
              before: [IdpRoles.Read],
              after: [IdpRoles.Admin],
            },
            appRoles: {
              before: {},
              after: {
                ROLE_NEW: { startDate: "2025-07-01", endDate: "2025-08-02" },
              },
            },
          },
        }),
        security: { pmccode: "0704" },
        segregationRef: `update-user-${userId}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("omits role changes and target user when a user edits themselves", async () => {
    const userId = "self-123";
    const self = User.createMock({ id: userId, idpRoles: [IdpRoles.Admin] });
    findById.mockResolvedValue(self);

    await updateUserUseCase({
      authenticatedUser: { id: userId, idpRoles: [IdpRoles.Admin] },
      userId,
      props: { idpRoles: [IdpRoles.Read] },
    });

    const auditArg = writeAuditEvent.mock.calls[0][0];
    expect(auditArg.details.changes).toBeUndefined();
    expect(auditArg.details.security.targetUser).toBeUndefined();
  });

  it("writes a FAILURE audit event when the update is forbidden", async () => {
    await updateUserUseCase({
      authenticatedUser: User.createMock({
        id: "other",
        idpRoles: [IdpRoles.ReadWrite],
      }),
      userId: "user-123",
      props: { name: "Name" },
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
  });

  it("produces a schema-valid audit payload with role changes", () => {
    const command = {
      authenticatedUser: { id: "admin-user", idpRoles: [IdpRoles.Admin] },
      userId: "user-123",
      auditRoleChange: {
        before: { idpRoles: [IdpRoles.Read], appRoles: {} },
        after: { idpRoles: [IdpRoles.Admin], appRoles: {} },
      },
    };
    const result = User.createMock({ id: "user-123" });

    const auditData = updateUserAuditDataBuilder([command], result);

    expect(validateAuditEvent(toPayload(auditData)).valid).toBe(true);
  });
});
