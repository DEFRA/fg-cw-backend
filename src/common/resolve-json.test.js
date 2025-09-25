import { describe, expect, it } from "vitest";
import { jp, populateUrlTemplate, resolveJSONPath } from "./resolve-json.js";

describe("resolveJSONPath", () => {
  const mockRoot = {
    _id: "case-id-123",
    caseRef: "REF-001",
    payload: {
      businessName: "Test Business",
      answers: {
        scheme: "SFI",
        year: 2025,
        isCompleted: true,
      },
    },
    definitions: {
      testKey: "testValue",
    },
  };

  describe("null and undefined handling", () => {
    it("should return null for null path", () => {
      const result = resolveJSONPath({ root: mockRoot, path: null });
      expect(result).toBe(null);
    });

    it("should return undefined for undefined path", () => {
      const result = resolveJSONPath({ root: mockRoot, path: undefined });
      expect(result).toBe(undefined);
    });
  });

  describe("string path resolution", () => {
    it("should resolve root JSON path references", () => {
      const result = resolveJSONPath({ root: mockRoot, path: "$.caseRef" });
      expect(result).toBe("REF-001");
    });

    it("should resolve nested JSON path references", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "$.payload.businessName",
      });
      expect(result).toBe("Test Business");
    });

    it("should resolve deep nested JSON path references", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "$.payload.answers.scheme",
      });
      expect(result).toBe("SFI");
    });

    it("should return empty string for non-existent paths", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "$.nonExistent.path",
      });
      expect(result).toBe("");
    });

    it("should resolve row references when row is provided", () => {
      const row = { id: "row-1", name: "Row Name" };
      const result = resolveJSONPath({
        root: mockRoot,
        path: "@.name",
        row,
      });
      expect(result).toBe("Row Name");
    });

    it("should handle literal references by removing escape character", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "\\$.literalPath",
      });
      expect(result).toBe("$.literalPath");
    });

    it("should return string as-is for non-reference strings", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "plain string",
      });
      expect(result).toBe("plain string");
    });

    it("should resolve embedded JSON paths in strings", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "Parcel ID: $.caseRef $.payload.answers.scheme checks",
      });
      expect(result).toBe("Parcel ID: REF-001 SFI checks");
    });

    it("should handle mixed embedded paths and literal escapes", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "Status: $.caseRef (format: \\$.literal)",
      });
      expect(result).toBe("Status: REF-001 (format: $.literal)");
    });

    it("should handle multiple embedded row references", () => {
      const row = { id: "row-1", name: "Row Name", status: "active" };
      const result = resolveJSONPath({
        root: mockRoot,
        path: "Row @.id has name @.name with status @.status",
        row,
      });
      expect(result).toBe("Row row-1 has name Row Name with status active");
    });

    it("should resolve your specific example", () => {
      const mockRootWithStatus = {
        ...mockRoot,
        status: "active",
      };
      const result = resolveJSONPath({
        root: mockRootWithStatus,
        path: "Parcel ID: $.caseRef $.status checks",
      });
      expect(result).toBe("Parcel ID: REF-001 active checks");
    });
  });

  describe("array path resolution", () => {
    it("should resolve each item in array recursively", () => {
      const path = ["$.caseRef", "$.payload.businessName", "plain text"];
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual(["REF-001", "Test Business", "plain text"]);
    });

    it("should handle nested arrays", () => {
      const path = [["$.caseRef", "$.payload.answers.scheme"], "plain text"];
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual(["REF-001", "SFI", "plain text"]);
    });
  });

  describe("object path resolution", () => {
    it("should resolve object properties recursively", () => {
      const path = {
        id: "$.id",
        ref: "$.caseRef",
        business: "$.payload.businessName",
        literal: "static text",
      };
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        id: "",
        ref: "REF-001",
        business: "Test Business",
        literal: "static text",
      });
    });

    it("should skip undefined values in resolved objects", () => {
      const path = {
        defined: "$.caseRef",
        undefined,
        null: null,
      };
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        defined: "REF-001",
        null: null,
      });
    });

    it("should not add default component if already specified", () => {
      const path = {
        component: "heading",
        text: "$.caseRef",
      };
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        component: "heading",
        text: "REF-001",
      });
    });

    it("should handle format application with fixed formatter", () => {
      const path = {
        text: "$.payload.answers.year",
        format: "fixed(2)",
      };
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        text: "2025.00",
      });
    });

    it("should handle format application with yesNo formatter", () => {
      const path = {
        text: "$.payload.answers.isCompleted",
        format: "yesNo",
      };
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        text: "Yes",
      });
    });

    it("should handle format application with formatDate formatter", () => {
      const mockRootWithDate = {
        ...mockRoot,
        submittedAt: "2025-03-28T11:30:52.000Z",
      };

      const path = {
        text: "$.submittedAt",
        format: "formatDate",
      };
      const result = resolveJSONPath({ root: mockRootWithDate, path });
      expect(result).toEqual({
        text: "28 Mar 2025",
      });
    });

    it("should handle nested objects with format application", () => {
      const mockRootWithNumbers = {
        ...mockRoot,
        metrics: {
          score: 85.7389,
          isValid: false,
          timestamp: "2025-01-15T10:00:00.000Z",
        },
      };

      const path = {
        component: "container",
        items: [
          {
            text: "$.metrics.score",
            format: "fixed(1)",
            label: "Score",
          },
          {
            text: "$.metrics.isValid",
            format: "yesNo",
            label: "Valid",
          },
          {
            text: "$.metrics.timestamp",
            format: "formatDate",
            label: "Date",
          },
        ],
      };

      const result = resolveJSONPath({ root: mockRootWithNumbers, path });
      expect(result).toEqual({
        component: "container",
        items: [
          {
            text: "85.7",
            label: "Score",
          },
          {
            text: "No",
            label: "Valid",
          },
          {
            text: "15 Jan 2025",
            label: "Date",
          },
        ],
      });
    });
  });

  describe("URL template resolution", () => {
    it("should resolve URL templates with parameters", () => {
      const path = {
        urlTemplate: "/cases/{caseId}",
        params: {
          caseId: "$._id",
        },
      };
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toBe("/cases/case-id-123");
    });

    it("should handle missing parameters", () => {
      const path = {
        urlTemplate: "/cases/{caseId}/{tabId}",
        params: {
          caseId: "$._id",
        },
      };
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toBe("/cases/case-id-123/");
    });

    it("should handle URL templates without params", () => {
      const path = {
        urlTemplate: "/static/url",
      };
      const result = resolveJSONPath({ root: mockRoot, path });
      expect(result).toBe("/static/url");
    });
  });

  describe("table section resolution", () => {
    const mockRootWithArray = {
      ...mockRoot,
      items: [
        { id: 1, name: "Item 1" },
        { id: 2, name: "Item 2" },
      ],
    };

    it("should resolve table sections with rowsRef and rows", () => {
      const path = {
        component: "table",
        title: "Items Table",
        rowsRef: "$.items[*]",
        rows: [
          { text: "@.id", label: "ID" },
          { text: "@.name", label: "Name" },
        ],
      };
      const result = resolveJSONPath({ root: mockRootWithArray, path });

      expect(result).toEqual({
        component: "table",
        title: "Items Table",
        rows: [
          [
            { text: 1, label: "ID" },
            { text: "Item 1", label: "Name" },
          ],
          [
            { text: 2, label: "ID" },
            { text: "Item 2", label: "Name" },
          ],
        ],
      });
    });
  });

  describe("repeatable section resolution", () => {
    const mockRootWithParcels = {
      ...mockRoot,
      parcels: [
        { id: "P001", status: "active", area: 12.5 },
        { id: "P002", status: "pending", area: 8.3 },
      ],
    };

    it("should resolve repeatable sections with rowsRef and items", () => {
      const path = {
        component: "repeatable",
        title: "Parcel List",
        rowsRef: "$.parcels[*]",
        items: [
          {
            text: "Parcel ID: @.id has status @.status",
            component: "text",
          },
          {
            text: "Area: @.area hectares",
            component: "text",
          },
        ],
      };
      const result = resolveJSONPath({ root: mockRootWithParcels, path });

      expect(result).toEqual([
        { text: "Parcel ID: P001 has status active", component: "text" },
        { text: "Area: 12.5 hectares", component: "text" },
        { text: "Parcel ID: P002 has status pending", component: "text" },
        { text: "Area: 8.3 hectares", component: "text" },
      ]);
    });

    it("should handle repeatable sections with single item template", () => {
      const path = {
        component: "container",
        classes: "parcel-list",
        rowsRef: "$.parcels[*]",
        items: [
          {
            text: "Parcel @.id: @.status (@.area ha)",
            classes: "govuk-body govuk-!-font-weight-bold",
          },
        ],
      };
      const result = resolveJSONPath({ root: mockRootWithParcels, path });

      expect(result).toEqual([
        {
          text: "Parcel P001: active (12.5 ha)",
          classes: "govuk-body govuk-!-font-weight-bold",
        },
        {
          text: "Parcel P002: pending (8.3 ha)",
          classes: "govuk-body govuk-!-font-weight-bold",
        },
      ]);
    });
  });

  describe("primitive values", () => {
    it("should return primitive values as-is", () => {
      expect(resolveJSONPath({ root: mockRoot, path: 42 })).toBe(42);
      expect(resolveJSONPath({ root: mockRoot, path: true })).toBe(true);
      expect(resolveJSONPath({ root: mockRoot, path: false })).toBe(false);
    });
  });
});

describe("jp function", () => {
  const mockRoot = {
    items: ["first", "second", "third"],
    nested: {
      value: "found",
    },
  };

  it("should return first match for valid path", () => {
    const result = jp({ root: mockRoot, path: "$.items[0]" });
    expect(result).toBe("first");
  });

  it("should return empty string for non-existent path", () => {
    const result = jp({ root: mockRoot, path: "$.nonExistent" });
    expect(result).toBe("");
  });

  it("should return empty string for non-string paths", () => {
    const result = jp({ root: mockRoot, path: 123 });
    expect(result).toBe("");
  });

  it("should handle row references", () => {
    const row = { prop: "row value" };
    const result = jp({ root: mockRoot, path: "@.prop", row });
    expect(result).toBe("row value");
  });

  it("should return empty array for literal references", () => {
    const result = jp({ root: mockRoot, path: "\\$.literal" });
    expect(result).toBe("");
  });
});

describe("populateUrlTemplate", () => {
  it("should replace single parameter", () => {
    const result = populateUrlTemplate("/cases/{caseId}", { caseId: "123" });
    expect(result).toBe("/cases/123");
  });

  it("should replace multiple parameters", () => {
    const result = populateUrlTemplate("/cases/{caseId}/tabs/{tabId}", {
      caseId: "123",
      tabId: "details",
    });
    expect(result).toBe("/cases/123/tabs/details");
  });

  it("should URL encode parameter values", () => {
    const result = populateUrlTemplate("/search?q={query}", {
      query: "test & special chars",
    });
    expect(result).toBe("/search?q=test%20%26%20special%20chars");
  });

  it("should handle missing parameters with empty string", () => {
    const result = populateUrlTemplate("/cases/{caseId}/{missing}", {
      caseId: "123",
    });
    expect(result).toBe("/cases/123/");
  });

  it("should handle null and undefined parameters", () => {
    const result = populateUrlTemplate("/cases/{nullParam}/{undefinedParam}", {
      nullParam: null,
      undefinedParam: undefined,
    });
    expect(result).toBe("/cases//");
  });

  it("should handle template without parameters", () => {
    const result = populateUrlTemplate("/static/url", {});
    expect(result).toBe("/static/url");
  });

  it("should handle very long parameter names (security test)", () => {
    const longKey = "a".repeat(150);
    const template = `/{${longKey}}`;
    const result = populateUrlTemplate(template, { [longKey]: "value" });
    expect(result).toBe(`/{${longKey}}`);
  });
});

describe("edge cases and error handling", () => {
  it("should handle circular references gracefully", () => {
    const circularRoot = { self: null };
    circularRoot.self = circularRoot;

    const result = resolveJSONPath({
      root: circularRoot,
      path: "$.nonExistent",
    });
    expect(result).toBe("");
  });

  it("should handle very deep nesting", () => {
    const deepRoot = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: "deep value",
            },
          },
        },
      },
    };

    const result = resolveJSONPath({
      root: deepRoot,
      path: "$.level1.level2.level3.level4.level5",
    });
    expect(result).toBe("deep value");
  });

  it("should handle arrays in JSON paths", () => {
    const arrayRoot = {
      items: [
        { id: 1, name: "first" },
        { id: 2, name: "second" },
      ],
    };

    const result = resolveJSONPath({
      root: arrayRoot,
      path: "$.items[1].name",
    });
    expect(result).toBe("second");
  });
});
