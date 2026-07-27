import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../models/idp-roles.js";
import { Role } from "../models/role.js";
import { User } from "../models/user.js";
import { findByCode, update } from "../repositories/role.repository.js";
import {
  updateRoleAuditDataBuilder,
  updateRoleUseCase,
} from "./update-role.use-case.js";

vi.mock("../repositories/role.repository.js");
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

describe("updateRoleUseCase auditing", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes a SUCCESS audit event with the actor and role code", async () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });
    findByCode.mockResolvedValue(
      Role.createMock({ code: "TEST.ROLE", description: "old" }),
    );
    update.mockResolvedValue();

    await updateRoleUseCase({
      user: admin,
      code: "TEST.ROLE",
      description: "new",
      assignable: true,
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          { entity: "ROLE", action: "UPDATE_ROLE", entityid: "TEST.ROLE" },
        ],
        details: {
          security: {
            actor: expect.objectContaining({ id: admin.id }),
          },
        },
        security: { pmccode: "0705" },
        messageGroupId: "update-role-TEST.ROLE",
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the role does not exist", async () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });
    findByCode.mockResolvedValue(null);

    await updateRoleUseCase({
      user: admin,
      code: "MISSING.ROLE",
      description: "new",
      assignable: true,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: auditStatus.FAILURE,
        messageGroupId: "update-role-MISSING.ROLE",
      }),
      null,
    );
  });

  it("produces a schema-valid audit payload", () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });

    const auditData = updateRoleAuditDataBuilder([
      { user: admin, code: "TEST.ROLE" },
    ]);

    expect(validateAuditEvent(toPayload(auditData)).valid).toBe(true);
  });
});
