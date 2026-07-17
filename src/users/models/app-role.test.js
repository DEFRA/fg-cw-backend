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
    it.each([
      {
        description: "endDate is after startDate",
        props: {
          name: "ROLE_VALID",
          startDate: "2025-07-01",
          endDate: "2025-12-01",
        },
      },
      {
        description: "endDate equals startDate",
        props: {
          name: "ROLE_EQUAL_DATES",
        },
        manualDates: {
          startDate: "2025-06-15",
          endDate: "2025-06-15",
        },
      },
      {
        description: "different date formats",
        props: {
          name: "ROLE_DATE_FORMAT",
          startDate: "2025-01-01",
          endDate: "2026-01-01",
        },
      },
      {
        description: "ISO date strings",
        props: {
          name: "ROLE_ISO_DATE",
          startDate: "2025-01-01",
          endDate: "2026-01-01",
        },
      },
    ])("validates successfully when $description", ({ props, manualDates }) => {
      const appRole = new AppRole(props);
      if (manualDates) {
        appRole.startDate = manualDates.startDate;
        appRole.endDate = manualDates.endDate;
      }

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
  });

  describe("isActive", () => {
    it.each([
      {
        description: "current date is within role date range",
        props: {
          name: "ROLE_ACTIVE",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
        systemTime: "2025-01-15T10:30:00.000Z",
        expected: true,
      },
      {
        description: "current date is before start date",
        props: {
          name: "ROLE_FUTURE",
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
        systemTime: "2025-01-15T10:30:00.000Z",
        expected: false,
      },
      {
        description: "current date is after end date",
        props: {
          name: "ROLE_EXPIRED",
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
        systemTime: "2025-01-15T10:30:00.000Z",
        expected: false,
      },
      {
        description: "current date equals start date at midnight",
        props: {
          name: "ROLE_START_TODAY",
          startDate: "2025-01-15",
          endDate: "2025-12-31",
        },
        systemTime: "2025-01-15T00:00:00.000Z",
        expected: true,
      },
      {
        description: "current date equals end date at end of day",
        props: {
          name: "ROLE_END_TODAY",
          startDate: "2025-01-01",
          endDate: "2025-01-15",
        },
        systemTime: "2025-01-15T23:59:59.999Z",
        expected: true,
      },
      {
        description: "startDate is missing and endDate is in the future",
        props: {
          name: "ROLE_NO_START",
          endDate: "2025-12-31",
        },
        systemTime: "2025-01-15T10:30:00.000Z",
        expected: true,
      },
      {
        description: "endDate is missing and startDate is in the past",
        props: {
          name: "ROLE_NO_END",
          startDate: "2025-01-01",
        },
        systemTime: "2025-01-15T10:30:00.000Z",
        expected: true,
      },
      {
        description: "both dates are missing",
        props: {
          name: "ROLE_NO_DATES",
        },
        systemTime: "2025-01-15T10:30:00.000Z",
        expected: true,
      },
      {
        description: "startDate is missing and endDate is in the past",
        props: {
          name: "ROLE_EXPIRED_NO_START",
          endDate: "2025-01-01",
        },
        systemTime: "2025-01-15T10:30:00.000Z",
        expected: false,
      },
      {
        description: "endDate is missing and startDate is in the future",
        props: {
          name: "ROLE_FUTURE_NO_END",
          startDate: "2025-02-01",
        },
        systemTime: "2025-01-15T10:30:00.000Z",
        expected: false,
      },
      {
        description: "current date is not provided (defaults to current date)",
        props: {
          name: "ROLE_ACTIVE_NOW",
          startDate: "2025-01-01",
          endDate: "2025-12-31",
        },
        expected: true,
      },
      {
        description: "current date is just after midnight on start date",
        props: {
          name: "ROLE_STARTS_MIDNIGHT",
          startDate: "2025-01-15",
          endDate: "2025-12-31",
        },
        systemTime: "2025-01-15T00:00:01.000Z",
        expected: true,
      },
      {
        description:
          "current date is just after midnight on day after end date",
        props: {
          name: "ROLE_ENDS_MIDNIGHT",
          startDate: "2025-01-01",
          endDate: "2025-01-15",
        },
        systemTime: "2025-01-16T00:00:00.000Z",
        expected: false,
      },
    ])(
      "returns $expected when $description",
      ({ props, systemTime, expected }) => {
        const role = new AppRole(props);
        if (systemTime) {
          vi.setSystemTime(new Date(systemTime));
        }
        expect(role.isActive()).toBe(expected);
      },
    );

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
