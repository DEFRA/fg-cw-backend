import Boom from "@hapi/boom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AccessControl } from "./access-control.js";

describe("AccessControl", () => {
  // Mock Date to control current time for role validation
  const mockDate = new Date("2025-07-15T12:00:00.000Z");

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("initialises with valid user appRoles", () => {
      const user = {
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
          ROLE_USER: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
          EXPIRED_ROLE: {
            startDate: "2025-06-01",
            endDate: "2025-07-01",
          },
        },
      };

      const accessControl = new AccessControl(user);

      // Should only include valid (non-expired) roles
      expect(accessControl.userAppRoles).toContain("ROLE_ADMIN");
      expect(accessControl.userAppRoles).toContain("ROLE_USER");
      expect(accessControl.userAppRoles).not.toContain("EXPIRED_ROLE");
    });

    it("handles empty user object", () => {
      const accessControl = new AccessControl({});
      expect(accessControl.userAppRoles).toEqual([]);
    });

    it("handles null user object", () => {
      const accessControl = new AccessControl(null);
      expect(accessControl.userAppRoles).toEqual([]);
    });

    it("handles user without appRoles", () => {
      const accessControl = new AccessControl({ id: "user123" });
      expect(accessControl.userAppRoles).toEqual([]);
    });
  });

  describe("canAccess", () => {
    it("returns true when no roles are required", () => {
      const user = {
        appRoles: {
          ROLE_USER: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({ allOf: [], anyOf: [] });
      expect(result).toBe(true);
    });

    it("returns true when user has all required allOf roles", () => {
      const user = {
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
          ROLE_MANAGER: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({
        allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
        anyOf: [],
      });
      expect(result).toBe(true);
    });

    it("returns false when user is missing any allOf role", () => {
      const user = {
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({
        allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
        anyOf: [],
      });
      expect(result).toBe(false);
    });

    it("returns true when user has any of the required anyOf roles", () => {
      const user = {
        appRoles: {
          ROLE_EDITOR: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({
        allOf: [],
        anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
      });
      expect(result).toBe(true);
    });

    it("returns false when user has none of the anyOf roles", () => {
      const user = {
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({
        allOf: [],
        anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
      });
      expect(result).toBe(false);
    });

    it("returns true when user has allOf and anyOf roles", () => {
      const user = {
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
          ROLE_EDITOR: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({
        allOf: ["ROLE_ADMIN"],
        anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
      });
      expect(result).toBe(true);
    });

    it("returns false when user has allOf roles but not anyOf role", () => {
      const user = {
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
          ROLE_MANAGER: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({
        allOf: ["ROLE_ADMIN"],
        anyOf: ["ROLE_EDITOR"],
      });
      expect(result).toBe(false);
    });

    it("returns false when user has anyOf role but not allOf roles", () => {
      const user = {
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
          ROLE_EDITOR: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({
        allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
        anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
      });
      expect(result).toBe(false);
    });

    it("returns false when user has no roles", () => {
      const accessControl = new AccessControl({});

      const result = accessControl.canAccess({
        allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
        anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
      });
      expect(result).toBe(false);
    });

    it("handles undefined requiredRoles gracefully", () => {
      const user = {
        appRoles: {
          ROLE_USER: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.canAccess({});
      expect(result).toBe(true);
    });
  });

  describe("authorise", () => {
    it("returns true when access is granted", () => {
      const user = {
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      const result = accessControl.authorise({
        allOf: ["ROLE_ADMIN"],
        anyOf: [],
      });
      expect(result).toBe(true);
    });

    it("throws Boom.forbidden when access is denied", () => {
      const user = {
        appRoles: {
          ROLE_USER: {
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          },
        },
      };
      const accessControl = new AccessControl(user);

      expect(() => {
        accessControl.authorise({
          allOf: ["ROLE_ADMIN"],
          anyOf: [],
        });
      }).toThrow(Boom.forbidden("Access denied"));
    });
  });
});
