import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { findById } from "../repositories/user.repository.js";
import {
  logoutUserAuditDataBuilder,
  logoutUserUseCase,
} from "./logout-user.use-case.js";

vi.mock("../repositories/user.repository.js");

vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

const mockUser = {
  id: "507f1f77bcf86cd799439011",
  idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
  name: "Bob Bill",
  email: "bob.bill@defra.gov.uk",
  idpRoles: ["ReadWrite"],
  appRoles: {},
};

describe("logoutUserUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the user resolved from the given id", async () => {
    findById.mockResolvedValue(mockUser);

    const result = await logoutUserUseCase({ userId: mockUser.id });

    expect(findById).toHaveBeenCalledWith(mockUser.id);
    expect(result).toEqual(mockUser);
  });

  it("writes a LOGOUT audit event with the actor's security context on success", async () => {
    findById.mockResolvedValue(mockUser);

    await logoutUserUseCase({ userId: mockUser.id });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "USER",
            action: "LOGOUT",
            entityid: mockUser.idpId,
          },
        ],
        details: {
          security: {
            actor: {
              id: mockUser.id,
              idpId: mockUser.idpId,
              name: mockUser.name,
              email: mockUser.email,
              idpRoles: mockUser.idpRoles,
            },
          },
        },
        security: { pmccode: "0703" },
        messageGroupId: `logout-${mockUser.idpId}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("throws and writes a FAILURE audit event when the user is not found", async () => {
    findById.mockResolvedValue(null);

    await expect(logoutUserUseCase({ userId: mockUser.id })).rejects.toThrow(
      `User with id '${mockUser.id}' not found`,
    );

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "USER",
            action: "LOGOUT",
            entityid: undefined,
          },
        ],
        details: { security: { actor: { id: mockUser.id } } },
        security: { pmccode: "0703" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("logoutUserAuditDataBuilder", () => {
  it("uses the resolved user as actor and idpId for entityid", () => {
    const auditData = logoutUserAuditDataBuilder(
      [{ userId: mockUser.id }],
      mockUser,
    );

    expect(auditData.entities[0]).toEqual({
      entity: "USER",
      action: "LOGOUT",
      entityid: mockUser.idpId,
    });
    expect(auditData.details.security.actor).toMatchObject({
      id: mockUser.id,
      idpId: mockUser.idpId,
      name: mockUser.name,
      email: mockUser.email,
      idpRoles: mockUser.idpRoles,
    });
    expect(auditData.messageGroupId).toBe(`logout-${mockUser.idpId}`);
  });

  it("falls back to the submitted id when there is no result", () => {
    const auditData = logoutUserAuditDataBuilder(
      [{ userId: mockUser.id }],
      undefined,
    );

    expect(auditData.entities[0].entityid).toBeUndefined();
    expect(auditData.details).toEqual({
      security: { actor: { id: mockUser.id } },
    });
    expect(auditData.messageGroupId).toBe(`logout-${mockUser.id}`);
  });

  it("includes a top-level security object for SOC forwarding", () => {
    const auditData = logoutUserAuditDataBuilder(
      [{ userId: mockUser.id }],
      mockUser,
    );

    expect(auditData.security).toEqual({ pmccode: "0703" });
  });
});
