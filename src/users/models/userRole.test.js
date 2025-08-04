import { describe, expect, it } from "vitest";
import { UserRole } from "./userRole.js";

describe("UserRole", () => {
  describe("constructor", () => {
    it("creates a UserRole with all properties", () => {
      const props = {
        roleName: "ROLE_ADMIN",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      };

      const userRole = new UserRole(props);

      expect(userRole.roleName).toBe("ROLE_ADMIN");
      expect(userRole.startDate).toBe("2025-01-01");
      expect(userRole.endDate).toBe("2025-12-31");
    });

    it("creates a UserRole with only roleName", () => {
      const props = {
        roleName: "ROLE_USER",
      };

      const userRole = new UserRole(props);

      expect(userRole.roleName).toBe("ROLE_USER");
      expect(userRole.startDate).toBeUndefined();
      expect(userRole.endDate).toBeUndefined();
    });

    it("creates a UserRole with roleName and startDate only", () => {
      const props = {
        roleName: "ROLE_TEMP",
        startDate: "2025-06-01",
      };

      const userRole = new UserRole(props);

      expect(userRole.roleName).toBe("ROLE_TEMP");
      expect(userRole.startDate).toBe("2025-06-01");
      expect(userRole.endDate).toBeUndefined();
    });

    it("creates a UserRole with roleName and endDate only", () => {
      const props = {
        roleName: "ROLE_LIMITED",
        endDate: "2025-12-31",
      };

      const userRole = new UserRole(props);

      expect(userRole.roleName).toBe("ROLE_LIMITED");
      expect(userRole.startDate).toBeUndefined();
      expect(userRole.endDate).toBe("2025-12-31");
    });

    it("does not call validateRole when startDate is missing", () => {
      const props = {
        roleName: "ROLE_TEST",
        endDate: "2025-12-31",
      };

      expect(() => new UserRole(props)).not.toThrow();
    });

    it("does not call validateRole when endDate is missing", () => {
      const props = {
        roleName: "ROLE_TEST",
        startDate: "2025-01-01",
      };

      expect(() => new UserRole(props)).not.toThrow();
    });

    it("calls validateRole when both startDate and endDate are present", () => {
      const props = {
        roleName: "ROLE_TEST",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      };

      expect(() => new UserRole(props)).not.toThrow();
    });

    it("throws error when endDate is before startDate", () => {
      const props = {
        roleName: "ROLE_INVALID",
        startDate: "2025-12-31",
        endDate: "2025-01-01",
      };

      expect(() => new UserRole(props)).toThrow(
        "endDate must be greater than startDate for role ROLE_INVALID. startDate: 2025-12-31, endDate: 2025-01-01",
      );
    });

    it("throws error when endDate equals startDate", () => {
      const props = {
        roleName: "ROLE_SAME_DATE",
        startDate: "2025-06-15",
        endDate: "2025-06-15",
      };

      expect(() => new UserRole(props)).toThrow(
        "endDate must be greater than startDate for role ROLE_SAME_DATE. startDate: 2025-06-15, endDate: 2025-06-15",
      );
    });
  });

  describe("validateRole", () => {
    it("validates successfully when endDate is after startDate", () => {
      const userRole = new UserRole({
        roleName: "ROLE_VALID",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      });

      expect(() => userRole.validateRole()).not.toThrow();
    });

    it("throws Boom.badRequest when endDate is before startDate", () => {
      const userRole = new UserRole({
        roleName: "ROLE_TEST",
      });
      userRole.startDate = "2025-12-31";
      userRole.endDate = "2025-01-01";

      expect(() => userRole.validateRole()).toThrow();

      try {
        userRole.validateRole();
      } catch (error) {
        expect(error.isBoom).toBe(true);
        expect(error.output.statusCode).toBe(400);
        expect(error.message).toBe(
          "endDate must be greater than startDate for role ROLE_TEST. startDate: 2025-12-31, endDate: 2025-01-01",
        );
      }
    });

    it("throws Boom.badRequest when endDate equals startDate", () => {
      const userRole = new UserRole({
        roleName: "ROLE_EQUAL_DATES",
      });
      userRole.startDate = "2025-06-15T10:00:00Z";
      userRole.endDate = "2025-06-15T10:00:00Z";

      expect(() => userRole.validateRole()).toThrow();

      try {
        userRole.validateRole();
      } catch (error) {
        expect(error.isBoom).toBe(true);
        expect(error.output.statusCode).toBe(400);
      }
    });

    it("handles different date formats correctly", () => {
      const userRole = new UserRole({
        roleName: "ROLE_DATE_FORMAT",
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-01-01T00:00:01Z",
      });

      expect(() => userRole.validateRole()).not.toThrow();
    });

    it("handles ISO date strings correctly", () => {
      const userRole = new UserRole({
        roleName: "ROLE_ISO_DATE",
        startDate: "2025-01-01T10:30:00.000Z",
        endDate: "2025-01-01T10:30:00.001Z",
      });

      expect(() => userRole.validateRole()).not.toThrow();
    });

    it("throws error with correct role name in message", () => {
      const userRole = new UserRole({
        roleName: "VERY_SPECIFIC_ROLE_NAME",
      });
      userRole.startDate = "2025-06-01";
      userRole.endDate = "2025-05-31";

      try {
        userRole.validateRole();
      } catch (error) {
        expect(error.message).toContain("VERY_SPECIFIC_ROLE_NAME");
        expect(error.message).toContain("startDate: 2025-06-01");
        expect(error.message).toContain("endDate: 2025-05-31");
      }
    });
  });

  describe("constructor validation integration", () => {
    it("validates immediately when both dates are provided in constructor", () => {
      expect(
        () =>
          new UserRole({
            roleName: "ROLE_IMMEDIATE_VALIDATION",
            startDate: "2025-12-31",
            endDate: "2025-01-01",
          }),
      ).toThrow(
        "endDate must be greater than startDate for role ROLE_IMMEDIATE_VALIDATION",
      );
    });

    it("allows manual validation later when dates are set separately", () => {
      const userRole = new UserRole({
        roleName: "ROLE_MANUAL_VALIDATION",
      });

      userRole.startDate = "2025-01-01";
      userRole.endDate = "2025-12-31";

      expect(() => userRole.validateRole()).not.toThrow();
    });

    it("skips validation in constructor when only one date is provided", () => {
      const userRole1 = new UserRole({
        roleName: "ROLE_ADMIN_1",
        startDate: "2025-01-01",
      });

      const userRole2 = new UserRole({
        roleName: "ROLE_ADMIN_2",
        endDate: "2025-12-31",
      });

      expect(userRole1.startDate).toBe("2025-01-01");
      expect(userRole1.endDate).toBeUndefined();
      expect(userRole2.startDate).toBeUndefined();
      expect(userRole2.endDate).toBe("2025-12-31");
    });
  });
});
