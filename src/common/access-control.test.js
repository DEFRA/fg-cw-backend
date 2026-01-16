import Boom from "@hapi/boom";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppRole } from "../users/models/app-role.js";
import { IdpRoles } from "../users/models/idp-roles.js";
import { User } from "../users/models/user.js";
import { AccessControl } from "./access-control.js";

describe("AccessControl", () => {
  const mockDate = new Date("2025-07-15T12:00:00.000Z");

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe("canAccess", () => {
    it("returns false when user is missing", () => {
      const result = AccessControl.canAccess(null, {
        idpRoles: [IdpRoles.ReadWrite],
        appRoles: { allOf: [], anyOf: [] },
      });

      expect(result).toBe(false);
    });

    it("returns true when no roles are required", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: { allOf: [], anyOf: [] },
      });
      expect(result).toBe(true);
    });

    it("returns true when user has all required app allOf roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ADMIN: new AppRole({
            name: "ROLE_ADMIN",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
          ROLE_MANAGER: new AppRole({
            name: "ROLE_MANAGER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: {
          allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
          anyOf: [],
        },
      });
      expect(result).toBe(true);
    });

    it("returns false when user is missing any app allOf role", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ADMIN: new AppRole({
            name: "ROLE_ADMIN",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: {
          allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
          anyOf: [],
        },
      });
      expect(result).toBe(false);
    });

    it("returns true when user has any of the required app anyOf roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_EDITOR: new AppRole({
            name: "ROLE_EDITOR",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: {
          allOf: [],
          anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
        },
      });
      expect(result).toBe(true);
    });

    it("returns false when user has none of the app anyOf roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ADMIN: new AppRole({
            name: "ROLE_ADMIN",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: {
          allOf: [],
          anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
        },
      });
      expect(result).toBe(false);
    });

    it("returns true when user has app allOf and anyOf roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ADMIN: new AppRole({
            name: "ROLE_ADMIN",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
          ROLE_EDITOR: new AppRole({
            name: "ROLE_EDITOR",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: {
          allOf: ["ROLE_ADMIN"],
          anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
        },
      });
      expect(result).toBe(true);
    });

    it("returns false when user has app allOf roles but not anyOf role", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ADMIN: new AppRole({
            name: "ROLE_ADMIN",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
          ROLE_MANAGER: new AppRole({
            name: "ROLE_MANAGER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: {
          allOf: ["ROLE_ADMIN"],
          anyOf: ["ROLE_EDITOR"],
        },
      });
      expect(result).toBe(false);
    });

    it("returns false when user has app anyOf role but not allOf roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ADMIN: new AppRole({
            name: "ROLE_ADMIN",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
          ROLE_EDITOR: new AppRole({
            name: "ROLE_EDITOR",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: {
          allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
          anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
        },
      });
      expect(result).toBe(false);
    });

    it("returns false when user has no app roles", () => {
      const user = new User({ idpId: "test-idp-id" });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: {
          allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
          anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
        },
      });
      expect(result).toBe(false);
    });

    it("handles empty app roles gracefully", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [],
        appRoles: { allOf: [], anyOf: [] },
      });
      expect(result).toBe(true);
    });

    it("returns true when user has required IDP role", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: [IdpRoles.ReadWrite],
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [IdpRoles.ReadWrite],
        appRoles: {
          allOf: [],
          anyOf: [],
        },
      });
      expect(result).toBe(true);
    });

    it("returns true when user has any of the required IDP roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: [IdpRoles.Read],
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [IdpRoles.Read, IdpRoles.ReadWrite, IdpRoles.Admin],
        appRoles: {
          allOf: [],
          anyOf: [],
        },
      });
      expect(result).toBe(true);
    });

    it("returns false when user has no required IDP roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: [IdpRoles.Read],
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [IdpRoles.ReadWrite, IdpRoles.Admin],
        appRoles: {
          allOf: [],
          anyOf: [],
        },
      });
      expect(result).toBe(false);
    });

    it("returns true when user has both required IDP and app roles", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: [IdpRoles.ReadWrite],
        appRoles: {
          ROLE_APPROVE: new AppRole({
            name: "ROLE_APPROVE",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [IdpRoles.ReadWrite, IdpRoles.Admin],
        appRoles: {
          allOf: ["ROLE_APPROVE"],
          anyOf: [],
        },
      });
      expect(result).toBe(true);
    });

    it("returns false when user has IDP role but missing app role", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: [IdpRoles.ReadWrite],
        appRoles: {
          ROLE_VIEW: new AppRole({
            name: "ROLE_VIEW",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [IdpRoles.ReadWrite],
        appRoles: {
          allOf: ["ROLE_APPROVE"],
          anyOf: [],
        },
      });
      expect(result).toBe(false);
    });

    it("returns false when user has app role but missing IDP role", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: [IdpRoles.Read],
        appRoles: {
          ROLE_APPROVE: new AppRole({
            name: "ROLE_APPROVE",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.canAccess(user, {
        idpRoles: [IdpRoles.ReadWrite, IdpRoles.Admin],
        appRoles: {
          allOf: ["ROLE_APPROVE"],
          anyOf: [],
        },
      });
      expect(result).toBe(false);
    });
  });

  describe("validation errors", () => {
    it("throws error when idpRoles is not supplied", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          appRoles: { allOf: [], anyOf: [] },
        });
      }).toThrow(Boom.badImplementation("idpRoles not supplied"));
    });

    it("throws error when idpRoles is null", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: null,
          appRoles: { allOf: [], anyOf: [] },
        });
      }).toThrow(Boom.badImplementation("idpRoles not supplied"));
    });

    it("throws error when idpRoles is not an array", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: "not-an-array",
          appRoles: { allOf: [], anyOf: [] },
        });
      }).toThrow(Boom.badImplementation("idpRoles not supplied"));
    });

    it("throws error when appRoles.allOf is not supplied", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: [],
          appRoles: { anyOf: [] },
        });
      }).toThrow(Boom.badImplementation("appRoles.allOf not supplied"));
    });

    it("throws error when appRoles.allOf is null", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: [],
          appRoles: { allOf: null, anyOf: [] },
        });
      }).toThrow(Boom.badImplementation("appRoles.allOf not supplied"));
    });

    it("throws error when appRoles.allOf is not an array", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: [],
          appRoles: { allOf: "not-an-array", anyOf: [] },
        });
      }).toThrow(Boom.badImplementation("appRoles.allOf not supplied"));
    });

    it("throws error when appRoles.anyOf is not supplied", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: [],
          appRoles: { allOf: [] },
        });
      }).toThrow(Boom.badImplementation("appRoles.anyOf not supplied"));
    });

    it("throws error when appRoles.anyOf is null", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: [],
          appRoles: { allOf: [], anyOf: null },
        });
      }).toThrow(Boom.badImplementation("appRoles.anyOf not supplied"));
    });

    it("throws error when appRoles.anyOf is not an array", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: [],
          appRoles: { allOf: [], anyOf: "not-an-array" },
        });
      }).toThrow(Boom.badImplementation("appRoles.anyOf not supplied"));
    });

    it("throws error when appRoles object is not supplied", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.canAccess(user, {
          idpRoles: [],
        });
      }).toThrow(Boom.badImplementation("appRoles.allOf not supplied"));
    });
  });

  describe("authorise", () => {
    it("throws Boom.badImplementation when user is missing", () => {
      expect(() => {
        AccessControl.authorise(null, {
          idpRoles: [IdpRoles.ReadWrite],
          appRoles: {
            allOf: [],
            anyOf: [],
          },
        });
      }).toThrow(Boom.badImplementation("User not supplied"));
    });

    it("returns true when access is granted", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_ADMIN: new AppRole({
            name: "ROLE_ADMIN",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      const result = AccessControl.authorise(user, {
        idpRoles: [],
        appRoles: {
          allOf: ["ROLE_ADMIN"],
          anyOf: [],
        },
      });
      expect(result).toBe(true);
    });

    it("throws Boom.forbidden when access is denied", () => {
      const user = new User({
        idpId: "test-idp-id",
        appRoles: {
          ROLE_USER: new AppRole({
            name: "ROLE_USER",
            startDate: "2025-07-01",
            endDate: "2025-08-01",
          }),
        },
      });

      expect(() => {
        AccessControl.authorise(user, {
          idpRoles: [],
          appRoles: {
            allOf: ["ROLE_ADMIN"],
            anyOf: [],
          },
        });
      }).toThrow(
        Boom.forbidden(
          `User ${user.id} does not have required roles to perform action`,
        ),
      );
    });

    it("throws Boom.forbidden when user lacks required IDP role", () => {
      const user = new User({
        idpId: "test-idp-id",
        idpRoles: [IdpRoles.Read],
      });

      expect(() => {
        AccessControl.authorise(user, {
          idpRoles: [IdpRoles.ReadWrite, IdpRoles.Admin],
          appRoles: {
            allOf: [],
            anyOf: [],
          },
        });
      }).toThrow(
        Boom.forbidden(
          `User ${user.id} does not have required roles to perform action`,
        ),
      );
    });
  });
});
