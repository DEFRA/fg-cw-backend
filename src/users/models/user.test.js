import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "./user.js";
import { UserRole } from "./userRole.js";

vi.mock("mongodb", () => ({
  ObjectId: vi.fn(() => ({
    toHexString: vi.fn(() => "507f1f77bcf86cd799439011"),
  })),
}));

vi.mock("./userRole.js", () => ({
  UserRole: vi.fn((props) => ({
    roleName: props.roleName,
    startDate: props.startDate,
    endDate: props.endDate,
  })),
}));

describe("User", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates a user with all provided properties", () => {
      const props = {
        id: "custom-id",
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "John Doe",
        email: "john.doe@defra.gov.uk",
        idpRoles: ["FCP.Casework.ReadWrite"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      };

      const user = new User(props);

      expect(user.id).toBe("custom-id");
      expect(user.idpId).toBe("6a232710-1c66-4f8b-967d-41d41ae38478");
      expect(user.name).toBe("John Doe");
      expect(user.email).toBe("john.doe@defra.gov.uk");
      expect(user.idpRoles).toEqual(["FCP.Casework.ReadWrite"]);
      expect(user.appRoles).toEqual({
        ROLE_RPA_CASES_APPROVE: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      });
      expect(user.createdAt).toBe("2025-01-01T00:00:00.000Z");
      expect(user.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    });

    it("generates an ObjectId when id is not provided", () => {
      const props = {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "John Doe",
        email: "john.doe@defra.gov.uk",
      };

      const user = new User(props);

      expect(user.id).toBe("507f1f77bcf86cd799439011");
      expect(ObjectId).toHaveBeenCalled();
    });

    it("defaults idpRoles to empty array when not provided", () => {
      const props = {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "John Doe",
        email: "john.doe@defra.gov.uk",
      };

      const user = new User(props);

      expect(user.idpRoles).toEqual([]);
    });

    it("accepts empty options parameter", () => {
      const props = {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "John Doe",
        email: "john.doe@defra.gov.uk",
      };

      expect(() => new User(props)).not.toThrow();
      expect(() => new User(props, {})).not.toThrow();
    });

    it("handles undefined properties gracefully", () => {
      const props = {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      };

      const user = new User(props);

      expect(user.name).toBeUndefined();
      expect(user.email).toBeUndefined();
      expect(user.appRoles).toBeUndefined();
      expect(user.createdAt).toBeUndefined();
      expect(user.updatedAt).toBeUndefined();
    });
  });

  describe("createAppRole", () => {
    let user;

    beforeEach(() => {
      user = new User({
        id: "test-id",
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "John Doe",
        email: "john.doe@defra.gov.uk",
      });
    });

    it("creates UserRole instances for valid appRoles object", () => {
      const appRoles = {
        ROLE_RPA_CASES_APPROVE: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
        ROLE_ADMIN: {
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
      };

      const result = user.createAppRole(appRoles);

      expect(result).toEqual({
        ROLE_RPA_CASES_APPROVE: {
          roleName: "ROLE_RPA_CASES_APPROVE",
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
        ROLE_ADMIN: {
          roleName: "ROLE_ADMIN",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
      });

      expect(UserRole).toHaveBeenCalledWith({
        roleName: "ROLE_RPA_CASES_APPROVE",
        startDate: "2025-07-01",
        endDate: "2025-08-02",
      });

      expect(UserRole).toHaveBeenCalledWith({
        roleName: "ROLE_ADMIN",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      });
    });

    it("returns empty object when appRoles is null", () => {
      const result = user.createAppRole(null);
      expect(result).toEqual({});
    });

    it("returns empty object when appRoles is undefined", () => {
      const result = user.createAppRole(undefined);
      expect(result).toEqual({});
    });

    it("returns empty object when appRoles is not an object", () => {
      expect(user.createAppRole("string")).toEqual({});
      expect(user.createAppRole(123)).toEqual({});
      expect(user.createAppRole([])).toEqual({});
      expect(user.createAppRole(true)).toEqual({});
    });

    it("handles empty appRoles object", () => {
      const result = user.createAppRole({});
      expect(result).toEqual({});
    });

    it("creates UserRole with undefined endDate when not provided", () => {
      const appRoles = {
        ROLE_TEMP: {
          startDate: "2025-07-01",
        },
      };

      const result = user.createAppRole(appRoles);

      expect(result).toEqual({
        ROLE_TEMP: {
          roleName: "ROLE_TEMP",
          startDate: "2025-07-01",
          endDate: undefined,
        },
      });

      expect(UserRole).toHaveBeenCalledWith({
        roleName: "ROLE_TEMP",
        startDate: "2025-07-01",
        endDate: undefined,
      });
    });
  });

  describe("createMock", () => {
    it("creates a mock user with default values", () => {
      const mockUser = User.createMock();

      expect(mockUser).toBeInstanceOf(User);
      expect(mockUser.idpId).toBe("6a232710-1c66-4f8b-967d-41d41ae38478");
      expect(mockUser.name).toBe("Bob Bill");
      expect(mockUser.email).toBe("bob.bill@defra.gov.uk");
      expect(mockUser.idpRoles).toEqual(["FCP.Casework.ReadWrite"]);
      expect(mockUser.appRoles).toEqual({
        ROLE_RPA_CASES_APPROVE: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      });
      expect(mockUser.createdAt).toBe("2025-01-01T00:00:00.000Z");
      expect(mockUser.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    });

    it("overrides default values with provided props", () => {
      const customProps = {
        id: "custom-id",
        name: "Custom Name",
        email: "custom@example.com",
        idpRoles: ["Custom.Role"],
      };

      const mockUser = User.createMock(customProps);

      expect(mockUser.id).toBe("custom-id");
      expect(mockUser.name).toBe("Custom Name");
      expect(mockUser.email).toBe("custom@example.com");
      expect(mockUser.idpRoles).toEqual(["Custom.Role"]);
      expect(mockUser.idpId).toBe("6a232710-1c66-4f8b-967d-41d41ae38478");
      expect(mockUser.appRoles).toEqual({
        ROLE_RPA_CASES_APPROVE: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
      });
    });

    it("works with empty props object", () => {
      const mockUser = User.createMock({});

      expect(mockUser).toBeInstanceOf(User);
      expect(mockUser.idpId).toBe("6a232710-1c66-4f8b-967d-41d41ae38478");
      expect(mockUser.name).toBe("Bob Bill");
    });

    it("handles partial prop overrides", () => {
      const mockUser = User.createMock({
        appRoles: {
          CUSTOM_ROLE: {
            startDate: "2025-01-01",
            endDate: "2025-12-31",
          },
        },
      });

      expect(mockUser.appRoles).toEqual({
        CUSTOM_ROLE: {
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
      });
      expect(mockUser.name).toBe("Bob Bill");
      expect(mockUser.email).toBe("bob.bill@defra.gov.uk");
    });
  });

  describe("integration", () => {
    it("creates a user and then creates app roles", () => {
      const user = new User({
        id: "test-id",
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "John Doe",
        email: "john.doe@defra.gov.uk",
      });

      const appRoles = {
        ROLE_ADMIN: {
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
      };

      const createdRoles = user.createAppRole(appRoles);

      expect(createdRoles).toEqual({
        ROLE_ADMIN: {
          roleName: "ROLE_ADMIN",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
      });
    });

    it("mock user can create app roles", () => {
      const mockUser = User.createMock();

      const newAppRoles = {
        NEW_ROLE: {
          startDate: "2025-06-01",
          endDate: "2025-09-30",
        },
      };

      const createdRoles = mockUser.createAppRole(newAppRoles);

      expect(createdRoles).toEqual({
        NEW_ROLE: {
          roleName: "NEW_ROLE",
          startDate: "2025-06-01",
          endDate: "2025-09-30",
        },
      });
    });
  });
});
