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
    it.each([
      {
        props: {
          name: "ROLE_ADMIN",
          startDate: "2025-07-01",
          endDate: "2025-12-01",
        },
        description: "all properties",
        expected: { startDate: "2025-07-01", endDate: "2025-12-01" },
      },
      {
        props: { name: "ROLE_USER" },
        description: "only name",
        expected: { startDate: undefined, endDate: undefined },
      },
      {
        props: { name: "ROLE_TEMP", startDate: "2025-12-01" },
        description: "name and startDate only",
        expected: { startDate: "2025-12-01", endDate: undefined },
      },
      {
        props: { name: "ROLE_LIMITED", endDate: "2025-12-01" },
        description: "name and endDate only",
        expected: { startDate: undefined, endDate: "2025-12-01" },
      },
    ])("creates a AppRole with $description", ({ props, expected }) => {
      const role = new AppRole(props);
      expect(role.startDate).toEqual(expected.startDate);
      expect(role.endDate).toEqual(expected.endDate);
    });

    it.each([
      {
        props: { name: "ROLE_TEST", endDate: "2025-01-01" },
        description: "startDate is missing",
      },
      {
        props: { name: "ROLE_TEST", startDate: "2025-07-01" },
        description: "endDate is missing",
      },
      {
        props: {
          name: "ROLE_TEST",
          startDate: "2025-07-01",
          endDate: "2025-12-01",
        },
        description: "both startDate and endDate are present",
      },
      {
        props: {
          name: "ROLE_SAME_DATE",
          startDate: "2025-07-01",
          endDate: "2025-07-01",
        },
        description: "endDate equals startDate",
      },
    ])("does not throw when $description", ({ props }) => {
      expect(() => new AppRole(props)).not.toThrow();
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

    it("validates successfully when endDate equals startDate", () => {
      const appRole = new AppRole({
        name: "ROLE_EQUAL_DATES",
      });
      appRole.startDate = "2025-06-15";
      appRole.endDate = "2025-06-15";

      expect(() => appRole.validateRole()).not.toThrow();
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

    it("returns true when startDate is missing and endDate is in the future", () => {
      const role = new AppRole({
        name: "ROLE_NO_START",
        endDate: "2025-12-31",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(true);
    });

    it("returns true when endDate is missing and startDate is in the past", () => {
      const role = new AppRole({
        name: "ROLE_NO_END",
        startDate: "2025-01-01",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(true);
    });

    it("returns true when both dates are missing", () => {
      const role = new AppRole({
        name: "ROLE_NO_DATES",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(true);
    });

    it("returns false when startDate is missing and endDate is in the past", () => {
      const role = new AppRole({
        name: "ROLE_EXPIRED_NO_START",
        endDate: "2025-01-01",
      });

      vi.setSystemTime(new Date("2025-01-15T10:30:00.000Z"));
      const result = role.isActive();

      expect(result).toBe(false);
    });

    it("returns false when endDate is missing and startDate is in the future", () => {
      const role = new AppRole({
        name: "ROLE_FUTURE_NO_END",
        startDate: "2025-02-01",
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
