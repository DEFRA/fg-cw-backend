import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "./user.js";
import { UserRole } from "./userRole.js";

const appRolesMultiple = {
  ROLE_RPA_CASES_APPROVE: {
    startDate: new Date("2025-07-01"),
    endDate: new Date("2025-08-02"),
  },
  ROLE_ADMIN: {
    startDate: new Date("2025-07-01"),
    endDate: new Date("2025-08-02"),
  },
};

const rolesMultiple = {
  ROLE_RPA_CASES_APPROVE: new UserRole({
    name: "ROLE_RPA_CASES_APPROVE",
    startDate: new Date("2025-07-01"),
    endDate: new Date("2025-08-02"),
  }),
  ROLE_ADMIN: new UserRole({
    name: "ROLE_ADMIN",
    startDate: new Date("2025-07-01"),
    endDate: new Date("2025-08-02"),
  }),
};

vi.mock("mongodb", () => ({
  ObjectId: vi.fn(() => ({
    toHexString: vi.fn(() => "507f1f77bcf86cd799439011"),
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

    it("creates Role instances for valid appRoles object", () => {
      const result = user.createAppRole(appRolesMultiple);

      expect(result).toStrictEqual(rolesMultiple);
    });

    it("creates Role with undefined endDate when not provided", () => {
      const appRoles = {
        ROLE_TEMP: {
          startDate: "2025-07-01",
        },
      };

      const result = user.createAppRole(appRoles);

      expect(result).toEqual({
        ROLE_TEMP: new UserRole({
          name: "ROLE_TEMP",
          startDate: "2025-07-01",
          endDate: undefined,
        }),
      });
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
        ROLE_ADMIN: new UserRole({
          name: "ROLE_ADMIN",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        }),
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
        NEW_ROLE: new UserRole({
          name: "NEW_ROLE",
          startDate: "2025-06-01",
          endDate: "2025-09-30",
        }),
      });
    });
  });
});
