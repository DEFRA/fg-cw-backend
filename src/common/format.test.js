import { describe, expect, it } from "vitest";
import { applyFormat, formatFunctions, parseFormatString } from "./format.js";

describe("formatFunctions", () => {
  describe("formatDate", () => {
    it("should format a date string to gov uk format", () => {
      const result = formatFunctions.formatDate("2025-09-01T10:07:55.256+0000");
      expect(result).toBe("1 Sept 2025");
    });

    it("should format a Date object to gov uk format", () => {
      const date = new Date("2025-09-11T10:07:55.256+0000");
      const result = formatFunctions.formatDate(date);
      expect(result).toBe("11 Sept 2025");
    });

    it("should handle different date formats", () => {
      const result = formatFunctions.formatDate("2025-01-15");
      expect(result).toBe("15 Jan 2025");
    });
  });

  describe("fixed", () => {
    it("should format a number to fixed decimal places", () => {
      const result = formatFunctions.fixed(3.14159, 2);
      expect(result).toBe("3.14");
    });

    it("should handle zero decimals", () => {
      const result = formatFunctions.fixed(3.14159, 0);
      expect(result).toBe("3");
    });

    it("should handle more decimals than available", () => {
      const result = formatFunctions.fixed(3, 4);
      expect(result).toBe("3.0000");
    });
  });

  describe("yesNo", () => {
    it("should return 'Yes' for true boolean", () => {
      const result = formatFunctions.yesNo(true);
      expect(result).toBe("Yes");
    });

    it("should return 'No' for false boolean", () => {
      const result = formatFunctions.yesNo(false);
      expect(result).toBe("No");
    });

    it("should return 'Yes' for 'true' string", () => {
      const result = formatFunctions.yesNo("true");
      expect(result).toBe("Yes");
    });

    it("should return 'Yes' for 'TRUE' string", () => {
      const result = formatFunctions.yesNo("TRUE");
      expect(result).toBe("Yes");
    });

    it("should return 'No' for 'false' string", () => {
      const result = formatFunctions.yesNo("false");
      expect(result).toBe("No");
    });

    it("should return 'No' for other values", () => {
      expect(formatFunctions.yesNo("yes")).toBe("No");
      expect(formatFunctions.yesNo(1)).toBe("No");
      expect(formatFunctions.yesNo(null)).toBe("No");
      expect(formatFunctions.yesNo(undefined)).toBe("No");
    });
  });
});

describe("parseFormatString", () => {
  it("should parse a simple format name", () => {
    const result = parseFormatString("formatDate");
    expect(result).toEqual({ name: "formatDate", params: [] });
  });

  it("should parse a format with single parameter", () => {
    const result = parseFormatString("fixed(2)");
    expect(result).toEqual({ name: "fixed", params: [2] });
  });

  it("should parse a format with multiple parameters", () => {
    const result = parseFormatString("custom(1,2,3)");
    expect(result).toEqual({ name: "custom", params: [1, 2, 3] });
  });

  it("should parse string parameters", () => {
    const result = parseFormatString("custom(a,b,c)");
    expect(result).toEqual({ name: "custom", params: ["a", "b", "c"] });
  });

  it("should parse mixed parameters", () => {
    const result = parseFormatString("custom(1,abc,2)");
    expect(result).toEqual({ name: "custom", params: [1, "abc", 2] });
  });

  it("should throw error for invalid format", () => {
    expect(() => parseFormatString("invalid format")).toThrow(
      "Invalid format: invalid format",
    );
  });

  it("should throw error for empty string", () => {
    expect(() => parseFormatString("")).toThrow("Invalid format: ");
  });
});

describe("applyFormat", () => {
  it("should apply formatDate function", () => {
    const result = applyFormat("2025-09-11", "formatDate");
    expect(result).toBe("11 Sept 2025");
  });

  it("should apply fixed function with parameters", () => {
    const result = applyFormat(3.14159, "fixed(2)");
    expect(result).toBe("3.14");
  });

  it("should apply yesNo function", () => {
    expect(applyFormat(true, "yesNo")).toBe("Yes");
    expect(applyFormat(false, "yesNo")).toBe("No");
  });

  it("should return original value for unknown format", () => {
    const result = applyFormat("test", "unknownFormat");
    expect(result).toBe("test");
  });

  it("should return original value when format parsing fails", () => {
    const result = applyFormat("test", "invalid format");
    expect(result).toBe("test");
  });

  it("should handle format function errors gracefully", () => {
    // Mock a format function that throws an error
    const originalFormatDate = formatFunctions.formatDate;
    formatFunctions.formatDate = () => {
      throw new Error("Test error");
    };

    const result = applyFormat("2025-09-11", "formatDate");
    expect(result).toBe("2025-09-11");

    // Restore original function
    formatFunctions.formatDate = originalFormatDate;
  });
});
