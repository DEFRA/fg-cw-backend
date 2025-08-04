import { describe, expect, it, vi } from "vitest";
import { updateUserRoleUseCase } from "../use-cases/update-user-role.use-case.js";
import { updateUserRoleRoute } from "./update-user-role.route.js";

vi.mock("../use-cases/update-user-role.use-case.js");

describe("updateUserRoleRoute", () => {
  describe("validation", () => {
    it("validates params with userId schema", () => {
      const paramsSchema = updateUserRoleRoute.options.validate.params;

      const validResult = paramsSchema.validate({
        userId: "507f1f77bcf86cd799439011",
      });
      expect(validResult.error).toBeUndefined();

      const invalidResult = paramsSchema.validate({ userId: "invalid" });
      expect(invalidResult.error).toBeDefined();
    });

    it("validates payload with userRoleSchema", () => {
      const payloadSchema = updateUserRoleRoute.options.validate.payload;

      const validPayload = {
        ROLE_ADMIN: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      };
      const validResult = payloadSchema.validate(validPayload);
      expect(validResult.error).toBeUndefined();

      expect(payloadSchema).toBeTruthy();
    });
  });

  describe("handler", () => {
    it("calls updateUserRoleUseCase with correct parameters", async () => {
      const mockUser = {
        id: "user-123",
        name: "John Doe",
        email: "john.doe@example.com",
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
        updatedAt: "2025-01-01T12:00:00.000Z",
      };

      updateUserRoleUseCase.mockResolvedValue(mockUser);

      const mockRequest = {
        params: {
          userId: "user-123",
        },
        payload: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
      };

      const result = await updateUserRoleRoute.handler(mockRequest);

      expect(updateUserRoleUseCase).toHaveBeenCalledWith({
        userId: "user-123",
        props: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
      });
      expect(result).toEqual(mockUser);
    });

    it("handles multiple role updates", async () => {
      const mockUser = {
        id: "user-123",
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
          "RPA-USER": {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      };

      updateUserRoleUseCase.mockResolvedValue(mockUser);

      const mockRequest = {
        params: {
          userId: "user-123",
        },
        payload: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
          "RPA-USER": {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      };

      const result = await updateUserRoleRoute.handler(mockRequest);

      expect(updateUserRoleUseCase).toHaveBeenCalledWith({
        userId: "user-123",
        props: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
          "RPA-USER": {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      });
      expect(result).toEqual(mockUser);
    });

    it("handles empty role payload", async () => {
      const mockUser = {
        id: "user-123",
        appRoles: {},
      };

      updateUserRoleUseCase.mockResolvedValue(mockUser);

      const mockRequest = {
        params: {
          userId: "user-123",
        },
        payload: {},
      };

      const result = await updateUserRoleRoute.handler(mockRequest);

      expect(updateUserRoleUseCase).toHaveBeenCalledWith({
        userId: "user-123",
        props: {},
      });
      expect(result).toEqual(mockUser);
    });

    it("forwards use case errors", async () => {
      const error = new Error("User not found");
      updateUserRoleUseCase.mockRejectedValue(error);

      const mockRequest = {
        params: {
          userId: "invalid-user-id",
        },
        payload: {
          ROLE_ADMIN: {
            startDate: "2025-01-01",
          },
        },
      };

      await expect(updateUserRoleRoute.handler(mockRequest)).rejects.toThrow(
        "User not found",
      );

      expect(updateUserRoleUseCase).toHaveBeenCalledWith({
        userId: "invalid-user-id",
        props: {
          ROLE_ADMIN: {
            startDate: "2025-01-01",
          },
        },
      });
    });

    it("handles role updates with only startDate", async () => {
      const mockUser = {
        id: "user-123",
        appRoles: {
          TEMPORARY_ROLE: {
            startDate: "2025-07-01",
          },
        },
      };

      updateUserRoleUseCase.mockResolvedValue(mockUser);

      const mockRequest = {
        params: {
          userId: "user-123",
        },
        payload: {
          TEMPORARY_ROLE: {
            startDate: "2025-07-01",
          },
        },
      };

      const result = await updateUserRoleRoute.handler(mockRequest);

      expect(updateUserRoleUseCase).toHaveBeenCalledWith({
        userId: "user-123",
        props: {
          TEMPORARY_ROLE: {
            startDate: "2025-07-01",
          },
        },
      });
      expect(result).toEqual(mockUser);
    });

    it("preserves user properties in response", async () => {
      const mockUser = {
        id: "user-123",
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "John Doe",
        email: "john.doe@example.com",
        idpRoles: ["FCP.Casework.ReadWrite"],
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T12:00:00.000Z",
      };

      updateUserRoleUseCase.mockResolvedValue(mockUser);

      const mockRequest = {
        params: {
          userId: "user-123",
        },
        payload: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
      };

      const result = await updateUserRoleRoute.handler(mockRequest);

      expect(result.id).toBe("user-123");
      expect(result.idpId).toBe("6a232710-1c66-4f8b-967d-41d41ae38478");
      expect(result.name).toBe("John Doe");
      expect(result.email).toBe("john.doe@example.com");
      expect(result.idpRoles).toEqual(["FCP.Casework.ReadWrite"]);
      expect(result.appRoles).toEqual({
        ROLE_ADMIN: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      });
      expect(result.createdAt).toBe("2025-01-01T00:00:00.000Z");
      expect(result.updatedAt).toBe("2025-01-01T12:00:00.000Z");
    });
  });

  describe("error handling", () => {
    it("generates validation errors from use case", async () => {
      const validationError = new Error("Invalid role data");
      updateUserRoleUseCase.mockRejectedValue(validationError);

      const mockRequest = {
        params: {
          userId: "user-123",
        },
        payload: {
          INVALID_ROLE: {
            startDate: "invalid-date",
          },
        },
      };

      await expect(updateUserRoleRoute.handler(mockRequest)).rejects.toThrow(
        "Invalid role data",
      );
    });

    it("generates authorisation errors from use case", async () => {
      const authError = new Error("Insufficient permissions");
      updateUserRoleUseCase.mockRejectedValue(authError);

      const mockRequest = {
        params: {
          userId: "user-123",
        },
        payload: {
          ADMIN_ROLE: {
            startDate: "2025-01-01",
          },
        },
      };

      await expect(updateUserRoleRoute.handler(mockRequest)).rejects.toThrow(
        "Insufficient permissions",
      );
    });
  });
});
