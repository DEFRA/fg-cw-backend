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

    it("should resolve multiple space-separated JSON path references", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "$.caseRef $.payload.businessName",
      });
      expect(result).toBe("REF-001 Test Business");
    });

    it("should resolve multiple space-separated JSON path references with null values filtered", () => {
      const result = resolveJSONPath({
        root: mockRoot,
        path: "$.caseRef $.nonExistent $.payload.businessName",
      });
      expect(result).toBe("REF-001 Test Business");
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
      expect(result).toEqual([["REF-001", "SFI"], "plain text"]);
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

  describe("accordion section resolution", () => {
    const mockRootWithSections = {
      ...mockRoot,
      sections: [
        { title: "Section 1", description: "First section" },
        { title: "Section 2", description: "Second section" },
      ],
    };

    it("should resolve accordion sections with itemsRef and items", () => {
      const path = {
        component: "accordion",
        id: "test-accordion",
        itemsRef: "$.sections[*]",
        items: {
          heading: [
            {
              component: "text",
              text: "@.title",
            },
          ],
          content: [
            {
              component: "text",
              text: "@.description",
            },
          ],
        },
      };
      const result = resolveJSONPath({ root: mockRootWithSections, path });

      expect(result).toEqual({
        component: "accordion",
        id: "test-accordion",
        items: [
          {
            heading: [
              {
                component: "text",
                text: "Section 1",
              },
            ],
            content: [
              {
                component: "text",
                text: "First section",
              },
            ],
          },
          {
            heading: [
              {
                component: "text",
                text: "Section 2",
              },
            ],
            content: [
              {
                component: "text",
                text: "Second section",
              },
            ],
          },
        ],
      });
    });

    it("should resolve accordion with summary sections", () => {
      const mockRootWithSummaries = {
        ...mockRoot,
        checks: [
          {
            name: "Area Check",
            summary: "Failed",
            details: "Area exceeds limit",
          },
          {
            name: "Eligibility Check",
            summary: "Passed",
            details: "All criteria met",
          },
        ],
      };

      const path = {
        component: "accordion",
        id: "checks-accordion",
        itemsRef: "$.checks[*]",
        items: {
          heading: [
            {
              component: "text",
              text: "@.name",
            },
          ],
          summary: [
            {
              component: "text",
              text: "@.summary",
            },
          ],
          content: [
            {
              component: "text",
              text: "@.details",
            },
          ],
        },
      };

      const result = resolveJSONPath({ root: mockRootWithSummaries, path });

      expect(result).toEqual({
        component: "accordion",
        id: "checks-accordion",
        items: [
          {
            heading: [
              {
                component: "text",
                text: "Area Check",
              },
            ],
            summary: [
              {
                component: "text",
                text: "Failed",
              },
            ],
            content: [
              {
                component: "text",
                text: "Area exceeds limit",
              },
            ],
          },
          {
            heading: [
              {
                component: "text",
                text: "Eligibility Check",
              },
            ],
            summary: [
              {
                component: "text",
                text: "Passed",
              },
            ],
            content: [
              {
                component: "text",
                text: "All criteria met",
              },
            ],
          },
        ],
      });
    });

    it("should resolve accordion with expanded state", () => {
      const mockRootWithItems = {
        ...mockRoot,
        faqs: [
          { question: "Q1", answer: "A1" },
          { question: "Q2", answer: "A2" },
        ],
      };

      const path = {
        component: "accordion",
        id: "faq-accordion",
        itemsRef: "$.faqs[*]",
        items: {
          heading: [
            {
              component: "text",
              text: "@.question",
            },
          ],
          content: [
            {
              component: "text",
              text: "@.answer",
            },
          ],
          expanded: false,
        },
      };

      const result = resolveJSONPath({ root: mockRootWithItems, path });

      expect(result).toEqual({
        component: "accordion",
        id: "faq-accordion",
        items: [
          {
            heading: [
              {
                component: "text",
                text: "Q1",
              },
            ],
            content: [
              {
                component: "text",
                text: "A1",
              },
            ],
            expanded: false,
          },
          {
            heading: [
              {
                component: "text",
                text: "Q2",
              },
            ],
            content: [
              {
                component: "text",
                text: "A2",
              },
            ],
            expanded: false,
          },
        ],
      });
    });

    it("should resolve accordion with nested components", () => {
      const mockRootWithComplex = {
        ...mockRoot,
        breeds: [
          {
            name: "White Pigs",
            count: 10,
            housing: "Indoor",
          },
          {
            name: "Landrace Pigs",
            count: 15,
            housing: "Outdoor",
          },
        ],
      };

      const path = {
        component: "accordion",
        id: "breeds-accordion",
        itemsRef: "$.breeds[*]",
        items: {
          heading: [
            {
              component: "text",
              text: "@.name",
            },
          ],
          summary: [
            {
              component: "text",
              text: "@.count",
            },
          ],
          content: [
            {
              component: "heading",
              text: "Breed Details",
              level: 3,
            },
            {
              component: "summary-list",
              rows: [
                {
                  label: "Count",
                  text: "@.count",
                  type: "number",
                },
                {
                  label: "Housing",
                  text: "@.housing",
                  type: "string",
                },
              ],
            },
          ],
        },
      };

      const result = resolveJSONPath({ root: mockRootWithComplex, path });

      expect(result).toEqual({
        component: "accordion",
        id: "breeds-accordion",
        items: [
          {
            heading: [
              {
                component: "text",
                text: "White Pigs",
              },
            ],
            summary: [
              {
                component: "text",
                text: 10,
              },
            ],
            content: [
              {
                component: "heading",
                text: "Breed Details",
                level: 3,
              },
              {
                component: "summary-list",
                rows: [
                  {
                    label: "Count",
                    text: 10,
                    type: "number",
                  },
                  {
                    label: "Housing",
                    text: "Indoor",
                    type: "string",
                  },
                ],
              },
            ],
          },
          {
            heading: [
              {
                component: "text",
                text: "Landrace Pigs",
              },
            ],
            summary: [
              {
                component: "text",
                text: 15,
              },
            ],
            content: [
              {
                component: "heading",
                text: "Breed Details",
                level: 3,
              },
              {
                component: "summary-list",
                rows: [
                  {
                    label: "Count",
                    text: 15,
                    type: "number",
                  },
                  {
                    label: "Housing",
                    text: "Outdoor",
                    type: "string",
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it("should resolve accordion when itemsRef is row-relative", () => {
      const mockRow = {
        subSections: [
          {
            title: "Row Section 1",
            description: "Row first section",
          },
          {
            title: "Row Section 2",
            description: "Row second section",
          },
        ],
      };

      const path = {
        component: "accordion",
        id: "nested-row-accordion",
        itemsRef: "@.subSections[*]",
        items: {
          heading: [
            {
              component: "text",
              text: "@.title",
            },
          ],
          content: [
            {
              component: "text",
              text: "@.description",
            },
          ],
        },
      };

      const result = resolveJSONPath({
        root: mockRoot,
        path,
        row: mockRow,
      });

      expect(result).toEqual({
        component: "accordion",
        id: "nested-row-accordion",
        items: [
          {
            heading: [
              {
                component: "text",
                text: "Row Section 1",
              },
            ],
            content: [
              {
                component: "text",
                text: "Row first section",
              },
            ],
          },
          {
            heading: [
              {
                component: "text",
                text: "Row Section 2",
              },
            ],
            content: [
              {
                component: "text",
                text: "Row second section",
              },
            ],
          },
        ],
      });
    });

    it("should resolve accordion with format application", () => {
      const mockRootWithDates = {
        ...mockRoot,
        events: [
          {
            title: "Application Submitted",
            date: "2025-03-28T11:30:52.000Z",
            isCompleted: true,
          },
          {
            title: "Review Started",
            date: "2025-03-29T09:00:00.000Z",
            isCompleted: false,
          },
        ],
      };

      const path = {
        component: "accordion",
        id: "events-accordion",
        itemsRef: "$.events[*]",
        items: {
          heading: [
            {
              component: "text",
              text: "@.title",
            },
          ],
          content: [
            {
              component: "summary-list",
              rows: [
                {
                  label: "Date",
                  text: "@.date",
                  format: "formatDate",
                },
                {
                  label: "Completed",
                  text: "@.isCompleted",
                  format: "yesNo",
                },
              ],
            },
          ],
        },
      };

      const result = resolveJSONPath({ root: mockRootWithDates, path });

      expect(result).toEqual({
        component: "accordion",
        id: "events-accordion",
        items: [
          {
            heading: [
              {
                component: "text",
                text: "Application Submitted",
              },
            ],
            content: [
              {
                component: "summary-list",
                rows: [
                  {
                    label: "Date",
                    text: "28 Mar 2025",
                  },
                  {
                    label: "Completed",
                    text: "Yes",
                  },
                ],
              },
            ],
          },
          {
            heading: [
              {
                component: "text",
                text: "Review Started",
              },
            ],
            content: [
              {
                component: "summary-list",
                rows: [
                  {
                    label: "Date",
                    text: "29 Mar 2025",
                  },
                  {
                    label: "Completed",
                    text: "No",
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it("should handle static accordion items (no itemsRef)", () => {
      const path = {
        component: "accordion",
        id: "static-accordion",
        items: [
          {
            heading: [
              {
                component: "text",
                text: "Static Section 1",
              },
            ],
            content: [
              {
                component: "text",
                text: "Static content 1",
              },
            ],
          },
          {
            heading: [
              {
                component: "text",
                text: "Static Section 2",
              },
            ],
            summary: [
              {
                component: "text",
                text: "Summary text",
              },
            ],
            content: [
              {
                component: "text",
                text: "Static content 2",
              },
            ],
            expanded: true,
          },
        ],
      };

      const result = resolveJSONPath({ root: mockRoot, path });

      expect(result).toEqual({
        component: "accordion",
        id: "static-accordion",
        items: [
          {
            heading: [
              {
                component: "text",
                text: "Static Section 1",
              },
            ],
            content: [
              {
                component: "text",
                text: "Static content 1",
              },
            ],
          },
          {
            heading: [
              {
                component: "text",
                text: "Static Section 2",
              },
            ],
            summary: [
              {
                component: "text",
                text: "Summary text",
              },
            ],
            content: [
              {
                component: "text",
                text: "Static content 2",
              },
            ],
            expanded: true,
          },
        ],
      });
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

  it("should resolve repeat components in summary lists", () => {
    const mockRootWithActions = {
      payload: {
        answers: {
          parcels: [
            {
              sheetId: "AB1234",
              parcelId: "10001",
              actions: [
                {
                  code: "CMOR1",
                  description: "Assess moorland",
                  annualPaymentPence: 35150,
                },
                {
                  code: "XXX",
                  description: "Second action",
                  annualPaymentPence: 42000,
                },
              ],
            },
          ],
        },
      },
    };

    const path = {
      component: "accordion",
      id: "land-parcels",
      itemsRef: "$.payload.answers.parcels[*]",
      items: {
        heading: [
          {
            text: "@.parcelId",
          },
        ],
        content: [
          {
            component: "summary-list",
            rows: [
              {
                label: "Land parcel",
                text: "@.parcelId",
              },
              {
                component: "repeat",
                itemsRef: "@.actions[*]",
                items: [
                  {
                    label: "Action",
                    text: "@.description",
                  },
                  {
                    label: "Action code",
                    text: "@.code",
                  },
                  {
                    label: "Yearly payment",
                    text: "@.annualPaymentPence",
                    format: "penniesToPounds",
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const result = resolveJSONPath({ root: mockRootWithActions, path });

    expect(result).toEqual({
      component: "accordion",
      id: "land-parcels",
      items: [
        {
          heading: [
            {
              text: "10001",
            },
          ],
          content: [
            {
              component: "summary-list",
              rows: [
                {
                  label: "Land parcel",
                  text: "10001",
                },
                {
                  label: "Action",
                  text: "Assess moorland",
                },
                {
                  label: "Action code",
                  text: "CMOR1",
                },
                {
                  label: "Yearly payment",
                  text: "£351.50",
                },
                {
                  label: "Action",
                  text: "Second action",
                },
                {
                  label: "Action code",
                  text: "XXX",
                },
                {
                  label: "Yearly payment",
                  text: "£420.00",
                },
              ],
            },
          ],
        },
      ],
    });
  });
});

describe("component-container resolution", () => {
  const mockRoot = {
    _id: "case-id-123",
    caseRef: "REF-001",
    actionData: {
      landGrants: {
        message: "Application validation run retrieved successfully",
        response: [
          {
            component: "heading",
            text: "Land parcel rules checks",
            level: 2,
            id: "title",
          },
          {
            component: "heading",
            text: "Parcel ID: SD6351 8781 checks",
            level: 3,
          },
          {
            component: "details",
            summaryItems: [
              {
                text: "CMOR1",
                classes: "govuk-details__summary-text",
              },
              {
                classes: "govuk-!-margin-left-8",
                component: "status",
                text: "Failed",
                colour: "red",
              },
            ],
            items: [
              {
                component: "paragraph",
                text: "Available area calculation explanation",
              },
            ],
          },
        ],
      },
    },
  };

  it("should resolve component-container with contentRef", () => {
    const path = {
      component: "component-container",
      contentRef: "$.actionData.landGrants.response",
    };

    const result = resolveJSONPath({ root: mockRoot, path });

    expect(result).toEqual([
      {
        component: "heading",
        text: "Land parcel rules checks",
        level: 2,
        id: "title",
      },
      {
        component: "heading",
        text: "Parcel ID: SD6351 8781 checks",
        level: 3,
      },
      {
        component: "details",
        summaryItems: [
          {
            text: "CMOR1",
            classes: "govuk-details__summary-text",
          },
          {
            classes: "govuk-!-margin-left-8",
            component: "status",
            text: "Failed",
            colour: "red",
          },
        ],
        items: [
          {
            component: "paragraph",
            text: "Available area calculation explanation",
          },
        ],
      },
    ]);
  });

  it("should return empty array for non-existent contentRef", () => {
    const path = {
      component: "component-container",
      contentRef: "$.actionData.nonExistent",
    };

    const result = resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual([]);
  });

  it("should flatten component-container in arrays", () => {
    const mockRootWithSections = {
      actionData: {
        sections: [
          { component: "text", text: "Section 1" },
          { component: "text", text: "Section 2" },
        ],
      },
    };

    const path = [
      { component: "heading", text: "Title" },
      {
        component: "component-container",
        contentRef: "$.actionData.sections",
      },
    ];

    const result = resolveJSONPath({ root: mockRootWithSections, path });

    expect(result).toEqual([
      { component: "heading", text: "Title" },
      { component: "text", text: "Section 1" },
      { component: "text", text: "Section 2" },
    ]);
  });

  it("should handle component-container with nested components", () => {
    const mockRootWithNested = {
      actionData: {
        complexContent: [
          {
            component: "accordion",
            id: "test-accordion",
            items: [
              {
                heading: [{ component: "text", text: "Section 1" }],
                content: [{ component: "paragraph", text: "Content 1" }],
              },
            ],
          },
          {
            component: "summary-list",
            rows: [
              { label: "Label 1", text: "Value 1" },
              { label: "Label 2", text: "Value 2" },
            ],
          },
        ],
      },
    };

    const path = {
      component: "component-container",
      contentRef: "$.actionData.complexContent",
    };

    const result = resolveJSONPath({ root: mockRootWithNested, path });

    expect(result).toEqual([
      {
        component: "accordion",
        id: "test-accordion",
        items: [
          {
            heading: [{ component: "text", text: "Section 1" }],
            content: [{ component: "paragraph", text: "Content 1" }],
          },
        ],
      },
      {
        component: "summary-list",
        rows: [
          { label: "Label 1", text: "Value 1" },
          { label: "Label 2", text: "Value 2" },
        ],
      },
    ]);
  });

  it("should handle empty component-container", () => {
    const mockRootWithEmpty = {
      actionData: {
        emptyContent: [],
      },
    };

    const path = {
      component: "component-container",
      contentRef: "$.actionData.emptyContent",
    };

    const result = resolveJSONPath({ root: mockRootWithEmpty, path });
    expect(result).toEqual([]);
  });
});
