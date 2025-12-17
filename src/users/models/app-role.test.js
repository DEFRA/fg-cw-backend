import Boom from "@hapi/boom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRole } from "./app-role.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

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

  describe("isActive", () => {
    it("returns true when current date is within role date range", () => {
      const role = new AppRole({
        name: "ROLE_ACTIVE",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(true);
    });

    it("returns false when current date is before start date", () => {
      const role = new AppRole({
        name: "ROLE_FUTURE",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(false);
    });

    it("returns false when current date is after end date", () => {
      const role = new AppRole({
        name: "ROLE_EXPIRED",
        startDate: "2024-01-01",
        endDate: "2024-12-31",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(false);
    });

    it("returns true when current date equals start date at midnight", () => {
      const role = new AppRole({
        name: "ROLE_START_TODAY",
        startDate: "2025-01-15",
        endDate: "2025-12-31",
      });

      vi.setSystemTime(new Date("2025-01-15T00:00:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(true);
    });

    it("returns true when current date equals end date at end of day", () => {
      const role = new AppRole({
        name: "ROLE_END_TODAY",
        startDate: "2025-01-01",
        endDate: "2025-01-15",
      });

      vi.setSystemTime(new Date("2025-01-15T23:59:59.999Z"));
      const result = role.isActive();

      expect(result).toBe(true);
    });

    it("returns false when startDate is missing", () => {
      const role = new AppRole({
        name: "ROLE_NO_START",
        endDate: "2025-12-31",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(false);
    });

    it("returns false when endDate is missing", () => {
      const role = new AppRole({
        name: "ROLE_NO_END",
        startDate: "2025-01-01",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(false);
    });

    it("returns false when both dates are missing", () => {
      const role = new AppRole({
        name: "ROLE_NO_DATES",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(false);
    });

    it("uses current date when no parameter is provided", () => {
      const role = new AppRole({
        name: "ROLE_ACTIVE_NOW",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      });

      const result = role.isActive();

      expect(result).toBe(true);
    });

    it("returns true for role active just after midnight on start date", () => {
      const role = new AppRole({
        name: "ROLE_STARTS_MIDNIGHT",
        startDate: "2025-01-15",
        endDate: "2025-12-31",
      });

      vi.setSystemTime(new Date("2025-01-15T00:00:01.000Z"));
      const result = role.isActive();

      expect(result).toBe(true);
    });

    it("returns false for role expired just after midnight on day after end date", () => {
      const role = new AppRole({
        name: "ROLE_ENDS_MIDNIGHT",
        startDate: "2025-01-01",
        endDate: "2025-01-15",
      });

      vi.setSystemTime(new Date("2025-01-16T00:00:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(false);
    });

    it("handles single day role correctly", () => {
      const role = new AppRole({
        name: "ROLE_ONE_DAY",
        startDate: "2025-01-15",
        endDate: "2025-01-16",
      });

      vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));
      expect(role.isActive()).toBe(true);

      vi.setSystemTime(new Date("2025-01-16T12:00:00.000Z"));
      expect(role.isActive()).toBe(true);

      vi.setSystemTime(new Date("2025-01-14T23:59:59.999Z"));
      expect(role.isActive()).toBe(false);

      vi.setSystemTime(new Date("2025-01-17T00:00:00.000Z"));
      expect(role.isActive()).toBe(false);
    });
  });
});
