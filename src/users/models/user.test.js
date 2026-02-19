import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRole } from "./app-role.js";
import { User } from "./user.js";

vi.mock("mongodb", () => ({
  ObjectId: vi.fn().mockImplementation(function () {
    this.toHexString = function () {
      return "507f1f77bcf86cd799439011";
    };
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("User", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ObjectId.mockImplementation(function () {
      this.toHexString = function () {
        return "507f1f77bcf86cd799439011";
      };
    });
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

    it("handles empty props object", () => {
      const props = {};

      const user = new User(props);

      expect(user.id).toBe("507f1f77bcf86cd799439011");
      expect(user.idpId).toBeUndefined();
      expect(user.name).toBeUndefined();
      expect(user.email).toBeUndefined();
      expect(user.idpRoles).toEqual([]);
      expect(user.appRoles).toBeUndefined();
      expect(user.createdAt).toBeUndefined();
      expect(user.updatedAt).toBeUndefined();
    });
  });

  describe("setName", () => {
    it("updates the user name and updatedAt timestamp", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Original Name",
        updatedAt: "2025-01-01T00:00:00.000Z",
      });

      user.setName("New Name");

      expect(user.name).toBe("New Name");
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("handles null name value", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Original Name",
      });

      user.setName(null);

      expect(user.name).toBeNull();
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("handles undefined name value", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Original Name",
      });

      user.setName(undefined);

      expect(user.name).toBeUndefined();
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("handles empty string name", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Original Name",
      });

      user.setName("");

      expect(user.name).toBe("");
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });
  });

  describe("assignIdpRoles", () => {
    it("updates idpRoles and updatedAt timestamp", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        idpRoles: ["OLD_ROLE"],
        updatedAt: "2025-01-01T00:00:00.000Z",
      });

      const newRoles = ["FCP.Casework.ReadWrite", "ADMIN"];
      user.assignIdpRoles(newRoles);

      expect(user.idpRoles).toEqual(["FCP.Casework.ReadWrite", "ADMIN"]);
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("handles empty array of roles", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        idpRoles: ["EXISTING_ROLE"],
      });

      user.assignIdpRoles([]);

      expect(user.idpRoles).toEqual([]);
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("handles null roles", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        idpRoles: ["EXISTING_ROLE"],
      });

      user.assignIdpRoles(null);

      expect(user.idpRoles).toBeNull();
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("replaces existing roles completely", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        idpRoles: ["ROLE1", "ROLE2", "ROLE3"],
      });

      user.assignIdpRoles(["NEW_ROLE"]);

      expect(user.idpRoles).toEqual(["NEW_ROLE"]);
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });
  });

  describe("getRoles", () => {
    it("returns array of active role names", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ACTIVE_1: new AppRole({
            name: "ROLE_ACTIVE_1",
            startDate: "2025-01-01",
            endDate: "2100-12-31",
          }),
          ROLE_ACTIVE_2: new AppRole({
            name: "ROLE_ACTIVE_2",
            startDate: "2025-01-01",
            endDate: "2100-12-31",
          }),
        },
      });

      const roles = user.getRoles();

      expect(roles).toEqual(["ROLE_ACTIVE_1", "ROLE_ACTIVE_2"]);
    });

    it("returns empty array when no active roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_EXPIRED: new AppRole({
            name: "ROLE_EXPIRED",
            startDate: "2024-01-01",
            endDate: "2024-12-31",
          }),
          ROLE_NOT_STARTED: new AppRole({
            name: "ROLE_NOT_STARTED",
            startDate: "2026-01-01",
            endDate: "2100-12-31",
          }),
        },
      });

      const roles = user.getRoles();

      expect(roles).toEqual([]);
    });

    it("filters out inactive roles and returns only active ones", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ACTIVE: new AppRole({
            name: "ROLE_ACTIVE",
            startDate: "2025-01-01",
            endDate: "2100-12-31",
          }),
          ROLE_EXPIRED: new AppRole({
            name: "ROLE_EXPIRED",
            startDate: "2024-01-01",
            endDate: "2024-12-31",
          }),
          ROLE_NOT_STARTED: new AppRole({
            name: "ROLE_NOT_STARTED",
            startDate: "2026-01-01",
            endDate: "2100-12-31",
          }),
        },
      });

      const roles = user.getRoles();

      expect(roles).toEqual(["ROLE_ACTIVE"]);
    });

    it("returns empty array when appRoles is empty object", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {},
      });

      const roles = user.getRoles();

      expect(roles).toEqual([]);
    });
  });

  describe("hasActiveRole", () => {
    it("returns true when user has active role", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ACTIVE: new AppRole({
            name: "ROLE_ACTIVE",
            startDate: "2025-01-01",
            endDate: "2100-12-31",
          }),
        },
      });

      expect(user.hasActiveRole("ROLE_ACTIVE")).toBe(true);
    });

    it("returns false when role exists but is not active", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_EXPIRED: new AppRole({
            name: "ROLE_EXPIRED",
            startDate: "2024-01-01",
            endDate: "2024-12-31",
          }),
        },
      });

      expect(user.hasActiveRole("ROLE_EXPIRED")).toBe(false);
    });

    it("returns false when role does not exist", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ACTIVE: new AppRole({
            name: "ROLE_ACTIVE",
            startDate: "2025-01-01",
            endDate: "2100-12-31",
          }),
        },
      });

      expect(user.hasActiveRole("NONEXISTENT_ROLE")).toBe(false);
    });

    it("returns false when appRoles is undefined", () => {
      const user = new User({
        idpId: "test-idp-id",
      });

      expect(user.hasActiveRole("ANY_ROLE")).toBe(false);
    });

    it("returns false when appRoles is empty object", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {},
      });

      expect(user.hasActiveRole("ANY_ROLE")).toBe(false);
    });

    it("returns true when role has wildcard startDate and future endDate", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_WILDCARD_START: new AppRole({
            name: "ROLE_WILDCARD_START",
            endDate: "2100-12-31",
          }),
        },
      });

      expect(user.hasActiveRole("ROLE_WILDCARD_START")).toBe(true);
    });
  });

  describe("hasIdpRole", () => {
    it("returns true when user has the IDP role", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: ["FCP.Casework.ReadWrite", "FCP.Casework.Admin"],
      });

      expect(user.hasIdpRole("FCP.Casework.ReadWrite")).toBe(true);
      expect(user.hasIdpRole("FCP.Casework.Admin")).toBe(true);
    });

    it("returns false when user does not have the IDP role", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: ["FCP.Casework.Read"],
      });

      expect(user.hasIdpRole("FCP.Casework.ReadWrite")).toBe(false);
      expect(user.hasIdpRole("FCP.Casework.Admin")).toBe(false);
    });

    it("returns false when idpRoles is undefined", () => {
      const user = new User({
        idpId: "test-idp-id",
      });

      expect(user.hasIdpRole("FCP.Casework.ReadWrite")).toBe(false);
    });

    it("returns false when idpRoles is empty array", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: [],
      });

      expect(user.hasIdpRole("FCP.Casework.ReadWrite")).toBe(false);
    });
  });

  describe("assignAppRoles", () => {
    it("updates appRoles and updatedAt timestamp", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        appRoles: { OLD_ROLE: { startDate: "2025-01-01" } },
        updatedAt: "2025-01-01T00:00:00.000Z",
      });

      const newAppRoles = {
        ROLE_RPA_CASES_APPROVE: {
          startDate: "2025-07-01",
          endDate: "2025-08-02",
        },
        ROLE_ADMIN: {
          startDate: "2025-06-01",
          endDate: "2100-12-31",
        },
      };

      user.assignAppRoles(newAppRoles);

      expect(user.appRoles).toEqual(newAppRoles);
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("handles empty object of roles", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        appRoles: { EXISTING_ROLE: { startDate: "2025-01-01" } },
      });

      user.assignAppRoles({});

      expect(user.appRoles).toEqual({});
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("handles null roles", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        appRoles: { EXISTING_ROLE: { startDate: "2025-01-01" } },
      });

      user.assignAppRoles(null);

      expect(user.appRoles).toBeNull();
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("replaces existing app roles completely", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        appRoles: {
          ROLE1: { startDate: "2025-01-01" },
          ROLE2: { startDate: "2025-02-01" },
        },
      });

      const newAppRoles = {
        NEW_ROLE: { startDate: "2025-03-01", endDate: "2025-03-31" },
      };

      user.assignAppRoles(newAppRoles);

      expect(user.appRoles).toEqual(newAppRoles);
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
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
      expect(mockUser.appRoles.ROLE_1).toBeInstanceOf(AppRole);
      expect(mockUser.createdAt).toBe("2025-01-01T00:00:00.000Z");
      expect(mockUser.updatedAt).toBe("2025-01-01T00:00:00.000Z");
    });

    it("creates a mock user with overridden properties", () => {
      const overrides = {
        name: "Jane Doe",
        email: "jane.doe@defra.gov.uk",
        idpRoles: ["CUSTOM_ROLE"],
      };

      const mockUser = User.createMock(overrides);

      expect(mockUser.name).toBe("Jane Doe");
      expect(mockUser.email).toBe("jane.doe@defra.gov.uk");
      expect(mockUser.idpRoles).toEqual(["CUSTOM_ROLE"]);
      expect(mockUser.idpId).toBe("6a232710-1c66-4f8b-967d-41d41ae38478");
      expect(mockUser.createdAt).toBe("2025-01-01T00:00:00.000Z");
    });

    it("creates mock user with custom app roles", () => {
      const customAppRoles = {
        CUSTOM_ROLE: new AppRole({
          name: "CUSTOM_ROLE",
          startDate: "2025-05-01",
          endDate: "2025-05-31",
        }),
      };

      const mockUser = User.createMock({ appRoles: customAppRoles });

      expect(mockUser.appRoles).toEqual(customAppRoles);
      expect(mockUser.appRoles.CUSTOM_ROLE).toBeInstanceOf(AppRole);
    });

    it("creates mock user with empty props", () => {
      const mockUser = User.createMock({});

      expect(mockUser).toBeInstanceOf(User);
      expect(mockUser.idpId).toBe("6a232710-1c66-4f8b-967d-41d41ae38478");
      expect(mockUser.name).toBe("Bob Bill");
    });

    it("creates mock user with null overrides", () => {
      const mockUser = User.createMock({ name: null, email: null });

      expect(mockUser.name).toBeNull();
      expect(mockUser.email).toBeNull();
      expect(mockUser.idpId).toBe("6a232710-1c66-4f8b-967d-41d41ae38478");
    });
  });

  describe("integration scenarios", () => {
    it("can chain multiple operations", () => {
      const user = new User({
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Original Name",
        updatedAt: "2025-01-01T00:00:00.000Z",
      });

      user.setName("Updated Name");
      user.assignIdpRoles(["NEW_ROLE1", "NEW_ROLE2"]);
      user.assignAppRoles({
        APP_ROLE: { startDate: "2025-01-01", endDate: "2100-12-31" },
      });

      expect(user.name).toBe("Updated Name");
      expect(user.idpRoles).toEqual(["NEW_ROLE1", "NEW_ROLE2"]);
      expect(user.appRoles).toEqual({
        APP_ROLE: { startDate: "2025-01-01", endDate: "2100-12-31" },
      });
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });

    it("maintains object integrity after multiple updates", () => {
      const user = new User({
        id: "test-id",
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Test User",
        email: "test@defra.gov.uk",
        createdAt: "2025-01-01T00:00:00.000Z",
      });

      const originalId = user.id;
      const originalIdpId = user.idpId;
      const originalEmail = user.email;
      const originalCreatedAt = user.createdAt;

      user.setName("New Name");
      user.assignIdpRoles(["ROLE1"]);
      user.assignAppRoles({ ROLE: { startDate: "2025-01-01" } });

      expect(user.id).toBe(originalId);
      expect(user.idpId).toBe(originalIdpId);
      expect(user.email).toBe(originalEmail);
      expect(user.createdAt).toBe(originalCreatedAt);
      expect(user.name).toBe("New Name");
      expect(user.idpRoles).toEqual(["ROLE1"]);
      expect(user.appRoles).toEqual({ ROLE: { startDate: "2025-01-01" } });
      expect(user.updatedAt).toBe("2025-01-15T10:30:00.000Z");
    });
  });
});
