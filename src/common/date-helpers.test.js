import { describe, expect, it } from "vitest";
import { isDateString } from "./date-helpers.js";

describe("isDateString", () => {
  describe("valid date strings", () => {
    it("returns true for valid ISO date (YYYY-MM-DD)", () => {
      expect(isDateString("2025-01-01")).toBe(true);
      expect(isDateString("2025-12-31")).toBe(true);
      expect(isDateString("2000-02-29")).toBe(true); // Leap year
      expect(isDateString("1999-06-15")).toBe(true);
    });

    it("returns true for valid ISO datetime (YYYY-MM-DDTHH:MM:SS)", () => {
      expect(isDateString("2025-01-01T10:30:45")).toBe(true);
      expect(isDateString("2025-12-31T23:59:59")).toBe(true);
      expect(isDateString("2000-02-29T00:00:00")).toBe(true);
    });

    it("returns true for valid ISO datetime with milliseconds (YYYY-MM-DDTHH:MM:SS.sss)", () => {
      expect(isDateString("2025-01-01T10:30:45.123")).toBe(true);
      expect(isDateString("2025-12-31T23:59:59.999")).toBe(true);
      expect(isDateString("2000-02-29T00:00:00.000")).toBe(true);
    });

    it("returns true for valid ISO datetime with Z timezone (YYYY-MM-DDTHH:MM:SSZ)", () => {
      expect(isDateString("2025-01-01T10:30:45Z")).toBe(true);
      expect(isDateString("2025-12-31T23:59:59Z")).toBe(true);
      expect(isDateString("2000-02-29T00:00:00Z")).toBe(true);
    });

    it("returns true for valid ISO datetime with milliseconds and Z timezone (YYYY-MM-DDTHH:MM:SS.sssZ)", () => {
      expect(isDateString("2025-01-01T10:30:45.123Z")).toBe(true);
      expect(isDateString("2025-12-31T23:59:59.999Z")).toBe(true);
      expect(isDateString("2000-02-29T00:00:00.000Z")).toBe(true);
    });
  });

  describe("invalid date strings due to regex pattern", () => {
    it("returns false for non-string values", () => {
      expect(isDateString(null)).toBe(false);
      expect(isDateString(undefined)).toBe(false);
      expect(isDateString(123)).toBe(false);
      expect(isDateString(new Date())).toBe(false);
      expect(isDateString(true)).toBe(false);
      expect(isDateString({})).toBe(false);
      expect(isDateString([])).toBe(false);
    });

    it("returns false for empty or whitespace strings", () => {
      expect(isDateString("")).toBe(false);
      expect(isDateString(" ")).toBe(false);
    });

    it("returns false for incorrect date format", () => {
      expect(isDateString("01/01/2025")).toBe(false);
      expect(isDateString("01-01-2025")).toBe(false);
      expect(isDateString("1/1/2025")).toBe(false);
      expect(isDateString("2025/01/01")).toBe(false);
      expect(isDateString("Jan 1, 2025")).toBe(false);
      expect(isDateString("2025-1-1")).toBe(false);
    });

    it("returns false for incorrect time format", () => {
      expect(isDateString("2025-01-01 10:30:45")).toBe(false); // Space instead of T
      expect(isDateString("2025-01-01T10:30")).toBe(false); // Missing seconds
      expect(isDateString("2025-01-01T10")).toBe(false); // Missing minutes and seconds
      expect(isDateString("2025-01-01T1:30:45")).toBe(false); // Missing leading zero in hour
      expect(isDateString("2025-01-01T10:3:45")).toBe(false); // Missing leading zero in minute
      expect(isDateString("2025-01-01T10:30:4")).toBe(false); // Missing leading zero in second
    });

    it("returns false for incorrect milliseconds format", () => {
      expect(isDateString("2025-01-01T10:30:45.12")).toBe(false); // Only 2 digits
      expect(isDateString("2025-01-01T10:30:45.1234")).toBe(false); // 4 digits
      expect(isDateString("2025-01-01T10:30:45.")).toBe(false); // Missing milliseconds
    });

    it("returns false for incorrect timezone format", () => {
      expect(isDateString("2025-01-01T10:30:45+01:00")).toBe(false); // Timezone offset not supported
      expect(isDateString("2025-01-01T10:30:45-05:00")).toBe(false); // Timezone offset not supported
      expect(isDateString("2025-01-01T10:30:45UTC")).toBe(false); // UTC text not supported
      expect(isDateString("2025-01-01T10:30:45z")).toBe(false); // Lowercase z
    });

    it("returns false for extra characters", () => {
      expect(isDateString(" 2025-01-01")).toBe(false); // Leading space
      expect(isDateString("2025-01-01 ")).toBe(false); // Trailing space
      expect(isDateString("x2025-01-01")).toBe(false); // Leading character
      expect(isDateString("2025-01-01x")).toBe(false); // Trailing character
    });
  });

  describe("invalid date strings due to invalid date values", () => {
    it("returns false for invalid months", () => {
      expect(isDateString("2025-00-01")).toBe(false); // Month 00
      expect(isDateString("2025-13-01")).toBe(false); // Month 13
      expect(isDateString("2025-99-01")).toBe(false); // Month 99
    });

    it("returns false for invalid days", () => {
      expect(isDateString("2025-01-00")).toBe(false); // Day 00
      expect(isDateString("2025-99-99")).toBe(false); // Invalid month and day
    });

    it("returns false for invalid hours", () => {
      expect(isDateString("2025-01-01T25:30:45")).toBe(false); // Hour 25
      expect(isDateString("2025-01-01T99:30:45")).toBe(false); // Hour 99
    });

    it("returns false for invalid minutes", () => {
      expect(isDateString("2025-01-01T10:60:00")).toBe(false); // Minute 60
      expect(isDateString("2025-01-01T10:99:45")).toBe(false); // Minute 99
    });

    it("returns false for invalid seconds", () => {
      expect(isDateString("2025-01-01T10:30:60")).toBe(false); // Second 60
      expect(isDateString("2025-01-01T10:30:99")).toBe(false); // Second 99
    });

    it("returns false for edge case invalid years", () => {
      // Year 0000 is technically valid in JavaScript (becomes year -1)
      expect(isDateString("0000-01-01")).toBe(true); // Year 0000 is valid
      expect(isDateString("9999-99-99")).toBe(false); // Invalid month/day with valid year format
    });

    it("handles various invalid but regex-matching patterns", () => {
      expect(isDateString("1234-56-78")).toBe(false); // Matches regex but invalid date
      expect(isDateString("9999-01-01T99:99:99")).toBe(false); // Matches regex but invalid time
      expect(isDateString("2025-01-01T10:30:45.999Z")).toBe(true); // Should be valid
    });
  });
});
