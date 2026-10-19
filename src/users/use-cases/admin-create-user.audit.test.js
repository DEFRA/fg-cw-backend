import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import Boom from "@hapi/boom";
import { BSON } from "mongodb";
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
        segregationRef: `create-user-${result.id}`,
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
        segregationRef: "create-user-dup@example.com",
      }),
      null,
    );
  });

  it("leaves entityid out of a FAILURE audit event, as no user exists yet", async () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });
    findByEmail.mockResolvedValue(User.createMock());

    await adminCreateUserUseCase({
      user: admin,
      props: { name: "Dup", email: "dup@example.com" },
    }).catch(() => {});

    const [{ entities, details }] = writeAuditEvent.mock.calls[0];

    expect(entities).toEqual([{ entity: "USER", action: "CREATE_USER" }]);
    expect(entities[0]).not.toHaveProperty("entityid");
    expect(details.security).toEqual({
      actor: expect.objectContaining({ id: admin.id }),
      attemptedUser: { email: "dup@example.com" },
    });
  });

  it("does not record an attemptedUser on SUCCESS", () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });
    const created = User.createMock({ id: "new-id", email: "n@e.com" });

    const auditData = adminCreateUserAuditDataBuilder(
      [{ user: admin, props: { email: "n@e.com" } }],
      created,
    );

    expect(auditData.details.security).not.toHaveProperty("attemptedUser");
  });

  // The dead-lettered event: the driver serialises with
  // `ignoreUndefined: false`, storing `undefined` as `null`, so this checks the
  // payload as persisted, not just as built.
  it("produces a schema-valid FAILURE payload once persisted", () => {
    const admin = User.createMock({ idpRoles: [IdpRoles.Admin] });

    const auditData = adminCreateUserAuditDataBuilder(
      [{ user: admin, props: { email: "dup@example.com" } }],
      undefined,
      Boom.conflict("A user with this email address already exists"),
    );

    const persisted = BSON.deserialize(
      BSON.serialize(toPayload(auditData, auditStatus.FAILURE), {
        ignoreUndefined: false,
      }),
    );

    expect(persisted.audit.entities[0]).not.toHaveProperty("entityid");
    expect(validateAuditEvent(persisted).valid).toBe(true);
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
