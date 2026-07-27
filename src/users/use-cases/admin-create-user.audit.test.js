import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../models/idp-roles.js";
import { User } from "../models/user.js";
import { findByEmail, save } from "../repositories/user.repository.js";
import {
  adminCreateUserAuditDataBuilder,
  adminCreateUserUseCase,
} from "./admin-create-user.use-case.js";

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

describe("adminCreateUserUseCase auditing", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes a SUCCESS audit event with the created user as target", async () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });
    findByEmail.mockResolvedValue(null);
    save.mockResolvedValue();

    const result = await adminCreateUserUseCase({
      user: admin,
      props: { name: "New User", email: "new@example.com" },
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "USER",
            action: "CREATE_USER",
            entityid: result.id,
          },
        ],
        details: {
          security: {
            actor: expect.objectContaining({ id: admin.id }),
            targetUser: expect.objectContaining({
              id: result.id,
              email: "new@example.com",
            }),
          },
        },
        security: { pmccode: "1204" },
        messageGroupId: `create-user-${result.id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when creation is rejected", async () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });
    findByEmail.mockResolvedValue(User.createMock());

    await adminCreateUserUseCase({
      user: admin,
      props: { name: "Dup", email: "dup@example.com" },
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: auditStatus.FAILURE,
        messageGroupId: "create-user-dup@example.com",
      }),
      null,
    );
  });

  it("produces a schema-valid audit payload", () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });
    const created = User.createMock({ id: "new-id", email: "n@e.com" });

    const auditData = adminCreateUserAuditDataBuilder(
      [{ user: admin, props: { email: "n@e.com" } }],
      created,
    );

    expect(validateAuditEvent(toPayload(auditData)).valid).toBe(true);
  });
});
