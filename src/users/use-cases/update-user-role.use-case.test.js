import { describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { update } from "../repositories/user.repository.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";
import { updateUserRoleUseCase } from "./update-user-role.use-case.js";

vi.mock("../repositories/user.repository.js");
vi.mock("./find-user-by-id.use-case.js");

describe("updateUserRoleUseCase", () => {
  it("updates user app roles successfully", async () => {
    const userId = "user-123";
    const mockUser = User.createMock({
      id: userId,
      idpId: "5de72998-417c-4b7c-815b-62bb77c25d82",
    });

    const roleProps = {
      ROLE_ADMIN: {
        startDate: "2025-07-01",
        endDate: "2025-08-02",
      },
    };

    mockUser.createAppRole = vi.fn().mockReturnValue(roleProps);

    findUserByIdUseCase.mockResolvedValue(mockUser);

    const result = await updateUserRoleUseCase({
      userId,
      props: roleProps,
    });

    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(mockUser.createAppRole).toHaveBeenCalledWith(roleProps);
    expect(result.appRoles).toEqual(roleProps);
    expect(result.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(update).toHaveBeenCalledWith(mockUser);
  });

  it("throws error when findUserByIdUseCase fails", async () => {
    const userId = "invalid-user-id";
    const error = new Error("User not found");

    findUserByIdUseCase.mockRejectedValue(error);

    await expect(
      updateUserRoleUseCase({
        userId,
        props: { ROLE_ADMIN: { startDate: "2025-01-01" } },
      }),
    ).rejects.toThrow("User not found");

    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when createAppRole method is missing", async () => {
    const userId = "user-123";
    const mockUser = {
      id: userId,
    };

    findUserByIdUseCase.mockResolvedValue(mockUser);

    await expect(
      updateUserRoleUseCase({
        userId,
        props: { ROLE_ADMIN: { startDate: "2025-01-01" } },
      }),
    ).rejects.toThrow("user.createAppRole is not a function");

    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when update repository fails", async () => {
    const userId = "user-123";
    const mockUser = User.createMock({
      id: userId,
    });

    const roleProps = {
      ROLE_ADMIN: {
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      },
    };

    mockUser.createAppRole = vi.fn().mockReturnValue(roleProps);
    findUserByIdUseCase.mockResolvedValue(mockUser);

    const repositoryError = new Error("Database update failed");
    update.mockRejectedValue(repositoryError);

    await expect(
      updateUserRoleUseCase({
        userId,
        props: roleProps,
      }),
    ).rejects.toThrow("Database update failed");

    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(mockUser.createAppRole).toHaveBeenCalledWith(roleProps);
    expect(update).toHaveBeenCalledWith(mockUser);
  });

  it("handles empty role props", async () => {
    const userId = "user-123";
    const mockUser = User.createMock({
      id: userId,
    });

    const emptyRoleProps = {};
    mockUser.createAppRole = vi.fn().mockReturnValue(emptyRoleProps);

    findUserByIdUseCase.mockResolvedValue(mockUser);

    const result = await updateUserRoleUseCase({
      userId,
      props: emptyRoleProps,
    });

    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(mockUser.createAppRole).toHaveBeenCalledWith(emptyRoleProps);
    expect(result.appRoles).toEqual(emptyRoleProps);
    expect(update).toHaveBeenCalledWith(mockUser);
  });

  it("handles multiple role assignments", async () => {
    const userId = "user-123";
    const mockUser = User.createMock({
      id: userId,
    });

    const multipleRoleProps = {
      ROLE_ADMIN: {
        startDate: "2025-07-01",
        endDate: "2025-08-02",
      },
      "RPA-USER": {
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      },
      ROLE_SUPERVISOR: {
        startDate: "2025-06-01",
        endDate: "2025-09-30",
      },
    };

    mockUser.createAppRole = vi.fn().mockReturnValue(multipleRoleProps);

    findUserByIdUseCase.mockResolvedValue(mockUser);

    const result = await updateUserRoleUseCase({
      userId,
      props: multipleRoleProps,
    });

    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(mockUser.createAppRole).toHaveBeenCalledWith(multipleRoleProps);
    expect(result.appRoles).toEqual(multipleRoleProps);
    expect(update).toHaveBeenCalledWith(mockUser);
  });

  it("preserves other user properties when updating roles", async () => {
    const userId = "user-123";
    const mockUser = User.createMock({
      id: userId,
      name: "John Doe",
      email: "john.doe@example.com",
      idpRoles: ["FCP.Casework.Read"],
    });

    const roleProps = {
      NEW_ROLE: {
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      },
    };

    mockUser.createAppRole = vi.fn().mockReturnValue(roleProps);

    findUserByIdUseCase.mockResolvedValue(mockUser);

    const result = await updateUserRoleUseCase({
      userId,
      props: roleProps,
    });

    // Verify other properties are preserved
    expect(result.name).toBe("John Doe");
    expect(result.email).toBe("john.doe@example.com");
    expect(result.idpRoles).toEqual(["FCP.Casework.Read"]);
    expect(result.appRoles).toEqual(roleProps);
    expect(result.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("sets updatedAt to current ISO string", async () => {
    const userId = "user-123";
    const mockUser = User.createMock({
      id: userId,
    });

    const roleProps = {
      ROLE_TEST: {
        startDate: "2025-01-01",
      },
    };

    mockUser.createAppRole = vi.fn().mockReturnValue(roleProps);

    findUserByIdUseCase.mockResolvedValue(mockUser);

    const beforeCall = new Date().toISOString();
    const result = await updateUserRoleUseCase({
      userId,
      props: roleProps,
    });
    const afterCall = new Date().toISOString();

    // Verify updatedAt is between before and after the call
    expect(result.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(result.updatedAt >= beforeCall).toBe(true);
    expect(result.updatedAt <= afterCall).toBe(true);
  });
});
