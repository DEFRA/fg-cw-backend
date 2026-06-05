import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { upsertLogin } from "../repositories/user.repository.js";
import { loginUserUseCase } from "./login-user.use-case.js";

vi.mock("../repositories/user.repository.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("../../common/write-audit-event.js", () => ({
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const loginProps = {
  idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
  name: "Bob Bill",
  email: "bob.bill@defra.gov.uk",
  idpRoles: ["ReadWrite"],
  appRoles: {},
};

describe("loginUserUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("creates new user with login timestamp", async () => {
    const mockUser = {
      id: "507f1f77bcf86cd799439011",
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["ReadWrite"],
      appRoles: {},
      createdAt: "2025-01-15T10:30:00.000Z",
      updatedAt: "2025-01-15T10:30:00.000Z",
      lastLoginAt: "2025-01-15T10:30:00.000Z",
    };

    upsertLogin.mockResolvedValue(mockUser);

    const result = await loginUserUseCase({
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["ReadWrite"],
      appRoles: {},
    });

    expect(upsertLogin).toHaveBeenCalledTimes(1);
    const calledWith = upsertLogin.mock.calls[0][0];
    expect(calledWith).toMatchObject({
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["ReadWrite"],
      createdAt: "2025-01-15T10:30:00.000Z",
      updatedAt: "2025-01-15T10:30:00.000Z",
      lastLoginAt: "2025-01-15T10:30:00.000Z",
    });
    expect(result.lastLoginAt).toBe("2025-01-15T10:30:00.000Z");
  });

  it("updates existing user with new login timestamp", async () => {
    const mockUser = {
      id: "507f1f77bcf86cd799439011",
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill Updated",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["ReadWrite", "Admin"],
      appRoles: {},
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2025-01-15T10:30:00.000Z",
      lastLoginAt: "2025-01-15T10:30:00.000Z",
    };

    upsertLogin.mockResolvedValue(mockUser);

    const result = await loginUserUseCase({
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill Updated",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["ReadWrite", "Admin"],
      appRoles: {},
    });

    expect(result.lastLoginAt).toBe("2025-01-15T10:30:00.000Z");
    expect(result.updatedAt).toBe("2025-01-15T10:30:00.000Z");
  });

  it("throws error when idpRoles is not provided", async () => {
    await expect(
      loginUserUseCase({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Bob Bill",
        email: "bob.bill@defra.gov.uk",
      }),
    ).rejects.toThrow(
      "User with IDP id '6a232710-1c66-4f8b-967d-41d41ae38478' has no 'roles'",
    );

    expect(upsertLogin).not.toHaveBeenCalled();
  });

  it("writes an audit event with SUCCESS status on login", async () => {
    upsertLogin.mockResolvedValue({
      ...loginProps,
      id: "507f1f77bcf86cd799439011",
    });

    await loginUserUseCase(loginProps);

    expect(writeAuditEvent).toHaveBeenCalledOnce();
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "User",
            action: "LOGIN_USER",
            entityid: "6a232710-1c66-4f8b-967d-41d41ae38478",
          },
        ],
        details: { email: "bob.bill@defra.gov.uk" },
        messageGroupId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        status: "SUCCESS",
      }),
      undefined,
    );
  });

  it("re-throws and writes an audit event with FAILURE status when login fails", async () => {
    upsertLogin.mockRejectedValueOnce(new Error("db error"));

    await expect(loginUserUseCase(loginProps)).rejects.toThrow("db error");

    await vi.waitFor(() => expect(writeAuditEvent).toHaveBeenCalledOnce());
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FAILURE" }),
      undefined,
    );
  });

  it("handles appRoles when provided", async () => {
    const mockUser = {
      id: "507f1f77bcf86cd799439011",
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["ReadWrite"],
      appRoles: {
        ROLE_1: {
          name: "ROLE_1",
          startDate: "2025-01-01",
          endDate: "2100-01-01",
        },
      },
      createdAt: "2025-01-15T10:30:00.000Z",
      updatedAt: "2025-01-15T10:30:00.000Z",
      lastLoginAt: "2025-01-15T10:30:00.000Z",
    };

    upsertLogin.mockResolvedValue(mockUser);

    const result = await loginUserUseCase({
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["ReadWrite"],
      appRoles: {
        ROLE_1: {
          name: "ROLE_1",
          startDate: "2025-01-01",
          endDate: "2100-01-01",
        },
      },
    });

    expect(upsertLogin).toHaveBeenCalledTimes(1);
    const calledWith = upsertLogin.mock.calls[0][0];
    expect(calledWith.appRoles.ROLE_1).toBeDefined();
    expect(calledWith.appRoles.ROLE_1.startDate).toBe("2025-01-01");
    expect(result.appRoles).toBeDefined();
  });
});
