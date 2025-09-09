import { describe, expect, it } from "vitest";
import { resolveBannerPaths } from "./resolve-paths.js";

describe("resolvePaths", () => {
  describe("resolveBannerPaths", () => {
    const mockCaseData = {
      id: "CASE-123",
      title: "Test Case",
      status: "open",
      createdDate: "2021-01-15T00:00:00.000Z",
      assignee: {
        name: "John Doe",
        email: "john.doe@example.com",
      },
      details: {
        priority: "high",
        category: "environmental",
      },
    };

    it("returns the same banner when no banner is provided", () => {
      const result = resolveBannerPaths(null, mockCaseData);
      expect(result).toBeNull();
    });

    it("returns the same banner when banner is undefined", () => {
      const result = resolveBannerPaths(undefined, mockCaseData);
      expect(result).toBeUndefined();
    });

    it("processes banner with title containing JSON path reference", () => {
      const banner = {
        title: {
          ref: "$.title",
          type: "text",
        },
      };

      const result = resolveBannerPaths(banner, mockCaseData);

      expect(result.title.value).toBe("Test Case");
      expect(result.title.ref).toBeUndefined();
      expect(result.title.type).toBe("text");
    });

    it("processes banner with title containing date JSON path reference", () => {
      const banner = {
        title: {
          ref: "$.createdDate",
          type: "date",
        },
      };

      const result = resolveBannerPaths(banner, mockCaseData);

      expect(result.title.value).toBe("2021-01-15T00:00:00.000Z");
      expect(result.title.ref).toBeUndefined();
      expect(result.title.type).toBe("date");
    });

    it("processes banner with summary fields containing JSON path references", () => {
      const banner = {
        summary: {
          status: {
            ref: "$.status",
            type: "text",
          },
          assignee: {
            ref: "$.assignee.name",
            type: "text",
          },
          priority: {
            ref: "$.details.priority",
            type: "text",
          },
        },
      };

      const result = resolveBannerPaths(banner, mockCaseData);

      expect(result.summary.status.value).toBe("open");
      expect(result.summary.status.ref).toBeUndefined();
      expect(result.summary.assignee.value).toBe("John Doe");
      expect(result.summary.assignee.ref).toBeUndefined();
      expect(result.summary.priority.value).toBe("high");
      expect(result.summary.priority.ref).toBeUndefined();
    });

    it("processes banner with mixed title and summary fields", () => {
      const banner = {
        title: {
          ref: "$.id",
          type: "text",
        },
        summary: {
          createdDate: {
            ref: "$.createdDate",
            type: "date",
          },
          category: {
            ref: "$.details.category",
            type: "text",
          },
        },
      };

      const result = resolveBannerPaths(banner, mockCaseData);

      expect(result.title.value).toBe("CASE-123");
      expect(result.summary.createdDate.value).toBe("2021-01-15T00:00:00.000Z");
      expect(result.summary.category.value).toBe("environmental");
    });

    it("sets empty string for fields with null/undefined JSON path values", () => {
      const banner = {
        title: {
          ref: "$.nonExistentField",
          type: "text",
        },
        summary: {
          missing: {
            ref: "$.does.not.exist",
            type: "text",
          },
        },
      };

      const result = resolveBannerPaths(banner, mockCaseData);

      expect(result.title.value).toBe("");
      expect(result.summary.missing.value).toBe("");
    });
  });
});
