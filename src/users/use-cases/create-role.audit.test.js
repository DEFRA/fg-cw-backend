import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../models/idp-roles.js";
import { User } from "../models/user.js";
import { save } from "../repositories/role.repository.js";
import {
  createRoleAuditDataBuilder,
  createRoleUseCase,
} from "./create-role.use-case.js";

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

describe("createRoleUseCase auditing", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes a SUCCESS audit event with the actor and role code", async () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });
    save.mockResolvedValue();

    await createRoleUseCase({
      user: admin,
      code: "TEST.ROLE",
      description: "desc",
      assignable: true,
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          { entity: "ROLE", action: "CREATE_ROLE", entityid: "TEST.ROLE" },
        ],
        details: {
          security: {
            actor: expect.objectContaining({ id: admin.id }),
          },
        },
        security: { pmccode: "0705" },
        segregationRef: "create-role-TEST.ROLE",
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the user is not an admin", async () => {
    const user = User.createMock({ idpRoles: [IdpRoles.Read] });

    await createRoleUseCase({
      user,
      code: "TEST.ROLE",
      description: "desc",
      assignable: true,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: auditStatus.FAILURE,
        segregationRef: "create-role-TEST.ROLE",
      }),
      null,
    );
  });

  it("produces a schema-valid audit payload", () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });

    const auditData = createRoleAuditDataBuilder([
      { user: admin, code: "TEST.ROLE" },
    ]);

    expect(validateAuditEvent(toPayload(auditData)).valid).toBe(true);
  });
});
