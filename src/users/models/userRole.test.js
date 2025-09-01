import Boom from "@hapi/boom";
import { describe, expect, it } from "vitest";
import { UserRole } from "./userRole.js";

describe("UserRole", () => {
  describe("constructor", () => {
    it("creates a UserRole with all properties", () => {
      const props = {
        name: "ROLE_ADMIN",
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-12-01T00:00:00.000Z"),
      };

      const role = new UserRole(props);

      expect(role.startDate).toEqual(new Date("2025-07-01"));
      expect(role.endDate).toEqual(new Date("2025-12-01T00:00:00.000Z"));
    });

    it("creates a UserRole with only name", () => {
      const props = {
        name: "ROLE_USER",
      };

      const role = new UserRole(props);

      expect(role.startDate).toBeUndefined();
      expect(role.endDate).toBeUndefined();
    });

    it("creates a Role with name and startDate only", () => {
      const props = {
        name: "ROLE_TEMP",
        startDate: new Date("2025-12-01T00:00:00.000Z"),
      };

      const role = new UserRole(props);

      expect(role.startDate).toEqual(new Date("2025-12-01T00:00:00.000Z"));
      expect(role.endDate).toBeUndefined();
    });

    it("creates a UserRole with name and endDate only", () => {
      const props = {
        name: "ROLE_LIMITED",
        endDate: new Date("2025-12-01T00:00:00.000Z"),
      };

      const userRole = new UserRole(props);

      expect(userRole.startDate).toBeUndefined();
      expect(userRole.endDate).toEqual(new Date("2025-12-01T00:00:00.000Z"));
    });

    it("does not call validateRole when startDate is missing", () => {
      const props = {
        name: "ROLE_TEST",
        endDate: new Date("2025-01-01T00:00:00.000Z"),
      };

      expect(() => new UserRole(props)).not.toThrow();
    });

    it("does not call validateRole when endDate is missing", () => {
      const props = {
        name: "ROLE_TEST",
        startDate: new Date("2025-07-01"),
      };

      expect(() => new UserRole(props)).not.toThrow();
    });

    it("calls validateRole when both startDate and endDate are present", () => {
      const props = {
        name: "ROLE_TEST",
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-12-01T00:00:00.000Z"),
      };

      expect(() => new UserRole(props)).not.toThrow();
    });

    it("throws error when endDate is before startDate", () => {
      const props = {
        name: "ROLE_INVALID",
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-01-01T00:00:00.000Z"),
      };

      expect(() => new UserRole(props)).toThrow(
        "endDate must be greater than startDate for role ROLE_INVALID.",
      );
    });

    it("throws error when endDate equals startDate", () => {
      const props = {
        name: "ROLE_SAME_DATE",
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-07-01"),
      };

      expect(() => new UserRole(props)).toThrow(
        "endDate must be greater than startDate for role ROLE_SAME_DATE.",
      );
    });
  });

  describe("validateRole", () => {
    it("validates successfully when endDate is after startDate", () => {
      const userRole = new UserRole({
        name: "ROLE_VALID",
        startDate: new Date("2025-07-01"),
        endDate: new Date("2025-12-01T00:00:00.000Z"),
      });

      expect(() => userRole.validateRole()).not.toThrow();
    });

    it("throws Boom.badRequest when endDate is before startDate", () => {
      expect(
        () =>
          new UserRole({
            name: "ROLE_TEST",
            startDate: new Date("2025-07-01"),
            endDate: new Date("2025-01-01T00:00:00.000Z"),
          }),
      ).toThrow(
        Boom.badRequest(
          `endDate must be greater than startDate for role ROLE_TEST.`,
        ),
      );
    });

    it("throws Boom.badRequest when endDate equals startDate", () => {
      const userRole = new UserRole({
        name: "ROLE_EQUAL_DATES",
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
        name: "ROLE_DATE_FORMAT",
        startDate: "2025-01-01T00:00:00Z",
        endDate: "2025-01-01T00:00:01Z",
      });

      expect(() => userRole.validateRole()).not.toThrow();
    });

    it("handles ISO date strings correctly", () => {
      const userRole = new UserRole({
        name: "ROLE_ISO_DATE",
        startDate: "2025-01-01T10:30:00.000Z",
        endDate: "2025-01-01T10:30:00.001Z",
      });

      expect(() => userRole.validateRole()).not.toThrow();
    });
  });
});
