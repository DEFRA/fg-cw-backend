import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { update } from "../repositories/user.repository.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";
import { updateUserRoleUseCase } from "./update-user-role.use-case.js";

vi.mock("../repositories/user.repository.js");
vi.mock("./find-user-by-id.use-case.js");

describe("updateUserRoleUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should update user roles successfully", async () => {
    // Arrange
    const userId = "user123";
    const mockUser = {
      id: userId,
      name: "John Doe",
      email: "john.doe@defra.gov.uk",
      appRoles: {
        ROLE_OLD: {
          startDate: "01/01/2024",
          endDate: "31/12/2024",
        },
      },
    };

    const newRoles = {
      ROLE_RPA_ADMIN: {
        startDate: "01/01/2025",
        endDate: "31/12/2025",
      },
      ROLE_RPA_USER: {
        startDate: "01/01/2025",
        endDate: "31/12/2025",
      },
    };

    findUserByIdUseCase.mockResolvedValue(mockUser);
    update.mockResolvedValue();

    // Act
    const result = await updateUserRoleUseCase({
      userId,
      props: newRoles,
    });

    // Assert
    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(findUserByIdUseCase).toHaveBeenCalledTimes(1);

    expect(mockUser.appRoles).toEqual(newRoles);
    expect(update).toHaveBeenCalledWith(mockUser);
    expect(update).toHaveBeenCalledTimes(1);

    expect(result).toEqual(mockUser);
    expect(result.appRoles).toEqual(newRoles);
  });

  it("should handle empty roles object", async () => {
    // Arrange
    const userId = "user123";
    const mockUser = {
      id: userId,
      name: "John Doe",
      email: "john.doe@defra.gov.uk",
      appRoles: {
        ROLE_EXISTING: {
          startDate: "01/01/2024",
          endDate: "31/12/2024",
        },
      },
    };

    const emptyRoles = {};

    findUserByIdUseCase.mockResolvedValue(mockUser);
    update.mockResolvedValue();

    // Act
    const result = await updateUserRoleUseCase({
      userId,
      props: emptyRoles,
    });

    // Assert
    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(mockUser.appRoles).toEqual(emptyRoles);
    expect(update).toHaveBeenCalledWith(mockUser);
    expect(result.appRoles).toEqual(emptyRoles);
  });

  it("should throw error when user is not found", async () => {
    // Arrange
    const userId = "nonexistent-user";
    const userError = new Error("User not found");
    const newRoles = {
      ROLE_RPA_ADMIN: {
        startDate: "01/01/2025",
        endDate: "31/12/2025",
      },
    };

    findUserByIdUseCase.mockRejectedValue(userError);

    // Act & Assert
    await expect(
      updateUserRoleUseCase({
        userId,
        props: newRoles,
      }),
    ).rejects.toThrow("User not found");

    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(findUserByIdUseCase).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });

  it("should throw error when repository update fails", async () => {
    // Arrange
    const userId = "user123";
    const mockUser = {
      id: userId,
      name: "John Doe",
      email: "john.doe@defra.gov.uk",
      appRoles: {
        ROLE_OLD: {
          startDate: "01/01/2024",
          endDate: "31/12/2024",
        },
      },
    };

    const newRoles = {
      ROLE_RPA_ADMIN: {
        startDate: "01/01/2025",
        endDate: "31/12/2025",
      },
    };

    const repositoryError = new Error("Database update failed");

    findUserByIdUseCase.mockResolvedValue(mockUser);
    update.mockRejectedValue(repositoryError);

    // Act & Assert
    await expect(
      updateUserRoleUseCase({
        userId,
        props: newRoles,
      }),
    ).rejects.toThrow("Database update failed");

    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
    expect(update).toHaveBeenCalledWith(mockUser);
    expect(mockUser.appRoles).toEqual(newRoles);
  });

  it("should replace all existing roles with new roles", async () => {
    // Arrange
    const userId = "user123";
    const mockUser = {
      id: userId,
      name: "John Doe",
      email: "john.doe@defra.gov.uk",
      appRoles: {
        ROLE_OLD_1: {
          startDate: "01/01/2024",
          endDate: "31/12/2024",
        },
        ROLE_OLD_2: {
          startDate: "01/01/2024",
          endDate: "31/12/2024",
        },
      },
    };

    const newRoles = {
      ROLE_NEW_1: {
        startDate: "01/01/2025",
        endDate: "31/12/2025",
      },
    };

    findUserByIdUseCase.mockResolvedValue(mockUser);
    update.mockResolvedValue();

    // Act
    const result = await updateUserRoleUseCase({
      userId,
      props: newRoles,
    });

    // Assert
    expect(result.appRoles).toEqual(newRoles);
    expect(result.appRoles).not.toHaveProperty("ROLE_OLD_1");
    expect(result.appRoles).not.toHaveProperty("ROLE_OLD_2");
    expect(Object.keys(result.appRoles)).toHaveLength(1);
  });

  it("should handle roles with only start date", async () => {
    // Arrange
    const userId = "user123";
    const mockUser = {
      id: userId,
      name: "John Doe",
      email: "john.doe@defra.gov.uk",
      appRoles: {},
    };

    const newRoles = {
      ROLE_RPA_ADMIN: {
        startDate: "01/01/2025",
      },
    };

    findUserByIdUseCase.mockResolvedValue(mockUser);
    update.mockResolvedValue();

    // Act
    const result = await updateUserRoleUseCase({
      userId,
      props: newRoles,
    });

    // Assert
    expect(result.appRoles).toEqual(newRoles);
    expect(result.appRoles.ROLE_RPA_ADMIN).toEqual({
      startDate: "01/01/2025",
    });
  });

  it("should handle roles with only end date", async () => {
    // Arrange
    const userId = "user123";
    const mockUser = {
      id: userId,
      name: "John Doe",
      email: "john.doe@defra.gov.uk",
      appRoles: {},
    };

    const newRoles = {
      ROLE_RPA_ADMIN: {
        endDate: "31/12/2025",
      },
    };

    findUserByIdUseCase.mockResolvedValue(mockUser);
    update.mockResolvedValue();

    // Act
    const result = await updateUserRoleUseCase({
      userId,
      props: newRoles,
    });

    // Assert
    expect(result.appRoles).toEqual(newRoles);
    expect(result.appRoles.ROLE_RPA_ADMIN).toEqual({
      endDate: "31/12/2025",
    });
  });
});
