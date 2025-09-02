import Boom from "@hapi/boom";
import { describe, expect, it } from "vitest";
import { AppRole } from "./app-role.js";

describe("AppRole", () => {
  describe("constructor", () => {
    it("creates a AppRole with all properties", () => {
      const props = {
        name: "ROLE_ADMIN",
        startDate: "2025-07-01",
        endDate: "2025-12-01",
      };

      const role = new AppRole(props);

      expect(role.startDate).toEqual("2025-07-01");
      expect(role.endDate).toEqual("2025-12-01");
    });

    it("creates a AppRole with only name", () => {
      const props = {
        name: "ROLE_USER",
      };

      const role = new AppRole(props);

      expect(role.startDate).toBeUndefined();
      expect(role.endDate).toBeUndefined();
    });

    it("creates a Role with name and startDate only", () => {
      const props = {
        name: "ROLE_TEMP",
        startDate: "2025-12-01",
      };

      const role = new AppRole(props);

      expect(role.startDate).toEqual("2025-12-01");
      expect(role.endDate).toBeUndefined();
    });

    it("creates a AppRole with name and endDate only", () => {
      const props = {
        name: "ROLE_LIMITED",
        endDate: "2025-12-01",
      };

      const appRole = new AppRole(props);

      expect(appRole.startDate).toBeUndefined();
      expect(appRole.endDate).toEqual("2025-12-01");
    });

    it("does not call validateRole when startDate is missing", () => {
      const props = {
        name: "ROLE_TEST",
        endDate: "2025-01-01",
      };

      expect(() => new AppRole(props)).not.toThrow();
    });

    it("does not call validateRole when endDate is missing", () => {
      const props = {
        name: "ROLE_TEST",
        startDate: "2025-07-01",
      };

      expect(() => new AppRole(props)).not.toThrow();
    });

    it("calls validateRole when both startDate and endDate are present", () => {
      const props = {
        name: "ROLE_TEST",
        startDate: "2025-07-01",
        endDate: "2025-12-01",
      };

      expect(() => new AppRole(props)).not.toThrow();
    });

    it("throws error when endDate is before startDate", () => {
      const props = {
        name: "ROLE_INVALID",
        startDate: "2025-07-01",
        endDate: "2025-01-01",
      };

      expect(() => new AppRole(props)).toThrow(
        "endDate must be greater than startDate for role ROLE_INVALID.",
      );
    });

    it("throws error when endDate equals startDate", () => {
      const props = {
        name: "ROLE_SAME_DATE",
        startDate: "2025-07-01",
        endDate: "2025-07-01",
      };

      expect(() => new AppRole(props)).toThrow(
        "endDate must be greater than startDate for role ROLE_SAME_DATE.",
      );
    });
  });

  describe("validateRole", () => {
    it("validates successfully when endDate is after startDate", () => {
      const appRole = new AppRole({
        name: "ROLE_VALID",
        startDate: "2025-07-01",
        endDate: "2025-12-01",
      });

      expect(() => appRole.validateRole()).not.toThrow();
    });

    it("throws Boom.badRequest when endDate is before startDate", () => {
      expect(
        () =>
          new AppRole({
            name: "ROLE_TEST",
            startDate: "2025-07-01",
            endDate: "2025-01-01",
          }),
      ).toThrow(
        Boom.badRequest(
          `endDate must be greater than startDate for role ROLE_TEST.`,
        ),
      );
    });

    it("throws Boom.badRequest when endDate equals startDate", () => {
      const appRole = new AppRole({
        name: "ROLE_EQUAL_DATES",
      });
      appRole.startDate = "2025-06-15";
      appRole.endDate = "2025-06-15";

      expect(() => appRole.validateRole()).toThrow();

      try {
        appRole.validateRole();
      } catch (error) {
        expect(error.isBoom).toBe(true);
        expect(error.output.statusCode).toBe(400);
      }
    });

    it("handles different date formats correctly", () => {
      const appRole = new AppRole({
        name: "ROLE_DATE_FORMAT",
        startDate: "2025-01-01",
        endDate: "2026-01-01",
      });

      expect(() => appRole.validateRole()).not.toThrow();
    });

    it("handles ISO date strings correctly", () => {
      const appRole = new AppRole({
        name: "ROLE_ISO_DATE",
        startDate: "2025-01-01",
        endDate: "2026-01-01",
      });

      expect(() => appRole.validateRole()).not.toThrow();
    });
  });
});
