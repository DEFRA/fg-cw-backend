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
    it("should return null for null path", async () => {
      const result = await resolveJSONPath({ root: mockRoot, path: null });
      expect(result).toBe(null);
    });

    it("should return undefined for undefined path", async () => {
      const result = await resolveJSONPath({ root: mockRoot, path: undefined });
      expect(result).toBe(undefined);
    });
  });

  describe("string path resolution", () => {
    it("should resolve root JSON path references", async () => {
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "$.caseRef",
      });
      expect(result).toBe("REF-001");
    });

    it("should resolve nested JSON path references", async () => {
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "$.payload.businessName",
      });
      expect(result).toBe("Test Business");
    });

    it("should resolve deep nested JSON path references", async () => {
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "$.payload.answers.scheme",
      });
      expect(result).toBe("SFI");
    });

    it("should return empty string for non-existent paths", async () => {
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "$.nonExistent.path",
      });
      expect(result).toBe("");
    });

    it("should resolve row references when row is provided", async () => {
      const row = { id: "row-1", name: "Row Name" };
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "@.name",
        row,
      });
      expect(result).toBe("Row Name");
    });

    it("should handle literal references by removing escape character", async () => {
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "\\$.literalPath",
      });
      expect(result).toBe("$.literalPath");
    });

    it("should return string as-is for non-reference strings", async () => {
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "plain string",
      });
      expect(result).toBe("plain string");
    });

    it("should resolve multiple space-separated JSON path references", async () => {
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "$.caseRef $.payload.businessName",
      });
      expect(result).toBe("REF-001 Test Business");
    });

    it("should resolve multiple space-separated JSON path references with null values filtered", async () => {
      const result = await resolveJSONPath({
        root: mockRoot,
        path: "$.caseRef $.nonExistent $.payload.businessName",
      });
      expect(result).toBe("REF-001 Test Business");
    });
  });

  describe("array path resolution", () => {
    it("should resolve each item in array recursively", async () => {
      const path = ["$.caseRef", "$.payload.businessName", "plain text"];
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual(["REF-001", "Test Business", "plain text"]);
    });

    it("should handle nested arrays", async () => {
      const path = [["$.caseRef", "$.payload.answers.scheme"], "plain text"];
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual([["REF-001", "SFI"], "plain text"]);
    });

    it("should filter out undefined values from arrays to prevent sparse arrays", async () => {
      const path = [
        {
          component: "text",
          text: "First item",
        },
        {
          component: "conditional",
          condition: "jsonata:$.payload.isActive = false",
          whenTrue: {
            component: "text",
            text: "Should not render",
          },
        },
        {
          component: "text",
          text: "Second item",
        },
      ];

      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual([
        {
          component: "text",
          text: "First item",
        },
        {
          component: "text",
          text: "Second item",
        },
      ]);
      // Ensure no undefined values in array
      expect(result).not.toContain(undefined);
      expect(result.length).toBe(2);
    });
  });

  describe("object path resolution", () => {
    it("should resolve object properties recursively", async () => {
      const path = {
        id: "$.id",
        ref: "$.caseRef",
        business: "$.payload.businessName",
        literal: "static text",
      };
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        id: "",
        ref: "REF-001",
        business: "Test Business",
        literal: "static text",
      });
    });

    it("should skip undefined values in resolved objects", async () => {
      const path = {
        defined: "$.caseRef",
        undefined,
        null: null,
      };
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        defined: "REF-001",
        null: null,
      });
    });

    it("should not add default component if already specified", async () => {
      const path = {
        component: "heading",
        text: "$.caseRef",
      };
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        component: "heading",
        text: "REF-001",
      });
    });

    it("should handle format application with fixed formatter", async () => {
      const path = {
        text: "$.payload.answers.year",
        format: "fixed(2)",
      };
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        text: "2025.00",
      });
    });

    it("should handle format application with yesNo formatter", async () => {
      const path = {
        text: "$.payload.answers.isCompleted",
        format: "yesNo",
      };
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toEqual({
        text: "Yes",
      });
    });

    it("should handle format application with formatDate formatter", async () => {
      const mockRootWithDate = {
        ...mockRoot,
        submittedAt: "2025-03-28T11:30:52.000Z",
      };

      const path = {
        text: "$.submittedAt",
        format: "formatDate",
      };
      const result = await resolveJSONPath({ root: mockRootWithDate, path });
      expect(result).toEqual({
        text: "28 Mar 2025",
      });
    });

    it("should handle nested objects with format application", async () => {
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

      const result = await resolveJSONPath({ root: mockRootWithNumbers, path });
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
    it("should resolve URL templates with parameters", async () => {
      const path = {
        urlTemplate: "/cases/{caseId}",
        params: {
          caseId: "$._id",
        },
      };
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toBe("/cases/case-id-123");
    });

    it("should handle missing parameters", async () => {
      const path = {
        urlTemplate: "/cases/{caseId}/{tabId}",
        params: {
          caseId: "$._id",
        },
      };
      const result = await resolveJSONPath({ root: mockRoot, path });
      expect(result).toBe("/cases/case-id-123/");
    });

    it("should handle URL templates without params", async () => {
      const path = {
        urlTemplate: "/static/url",
      };
      const result = await resolveJSONPath({ root: mockRoot, path });
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

    it("should resolve table sections with rowsRef and rows", async () => {
      const path = {
        component: "table",
        title: "Items Table",
        rowsRef: "$.items[*]",
        rows: [
          { text: "@.id", label: "ID" },
          { text: "@.name", label: "Name" },
        ],
      };
      const result = await resolveJSONPath({ root: mockRootWithArray, path });

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

    it("should resolve accordion sections with itemsRef and items", async () => {
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
      const result = await resolveJSONPath({
        root: mockRootWithSections,
        path,
      });

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

    it("should resolve accordion with summary sections", async () => {
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

      const result = await resolveJSONPath({
        root: mockRootWithSummaries,
        path,
      });

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

    it("should resolve accordion with expanded state", async () => {
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

      const result = await resolveJSONPath({ root: mockRootWithItems, path });

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

    it("should resolve accordion with nested components", async () => {
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

      const result = await resolveJSONPath({ root: mockRootWithComplex, path });

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

    it("should resolve accordion when itemsRef is row-relative", async () => {
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

      const result = await resolveJSONPath({
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

    it("should resolve accordion with format application", async () => {
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

      const result = await resolveJSONPath({ root: mockRootWithDates, path });

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

    it("should handle static accordion items (no itemsRef)", async () => {
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

      const result = await resolveJSONPath({ root: mockRoot, path });

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
    it("should return primitive values as-is", async () => {
      expect(await resolveJSONPath({ root: mockRoot, path: 42 })).toBe(42);
      expect(await resolveJSONPath({ root: mockRoot, path: true })).toBe(true);
      expect(await resolveJSONPath({ root: mockRoot, path: false })).toBe(
        false,
      );
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

  it("should return first match for valid path", async () => {
    const result = jp({ root: mockRoot, path: "$.items[0]" });
    expect(result).toBe("first");
  });

  it("should return empty string for non-existent path", async () => {
    const result = jp({ root: mockRoot, path: "$.nonExistent" });
    expect(result).toBe("");
  });

  it("should return empty string for non-string paths", async () => {
    const result = jp({ root: mockRoot, path: 123 });
    expect(result).toBe("");
  });

  it("should handle row references", async () => {
    const row = { prop: "row value" };
    const result = jp({ root: mockRoot, path: "@.prop", row });
    expect(result).toBe("row value");
  });

  it("should return empty array for literal references", async () => {
    const result = jp({ root: mockRoot, path: "\\$.literal" });
    expect(result).toBe("");
  });
});

describe("populateUrlTemplate", () => {
  it("should replace single parameter", async () => {
    const result = populateUrlTemplate("/cases/{caseId}", { caseId: "123" });
    expect(result).toBe("/cases/123");
  });

  it("should replace multiple parameters", async () => {
    const result = populateUrlTemplate("/cases/{caseId}/tabs/{tabId}", {
      caseId: "123",
      tabId: "details",
    });
    expect(result).toBe("/cases/123/tabs/details");
  });

  it("should URL encode parameter values", async () => {
    const result = populateUrlTemplate("/search?q={query}", {
      query: "test & special chars",
    });
    expect(result).toBe("/search?q=test%20%26%20special%20chars");
  });

  it("should handle missing parameters with empty string", async () => {
    const result = populateUrlTemplate("/cases/{caseId}/{missing}", {
      caseId: "123",
    });
    expect(result).toBe("/cases/123/");
  });

  it("should handle null and undefined parameters", async () => {
    const result = populateUrlTemplate("/cases/{nullParam}/{undefinedParam}", {
      nullParam: null,
      undefinedParam: undefined,
    });
    expect(result).toBe("/cases//");
  });

  it("should handle template without parameters", async () => {
    const result = populateUrlTemplate("/static/url", {});
    expect(result).toBe("/static/url");
  });

  it("should handle very long parameter names (security test)", async () => {
    const longKey = "a".repeat(150);
    const template = `/{${longKey}}`;
    const result = populateUrlTemplate(template, { [longKey]: "value" });
    expect(result).toBe(`/{${longKey}}`);
  });
});

describe("edge cases and error handling", () => {
  it("should handle circular references gracefully", async () => {
    const circularRoot = { self: null };
    circularRoot.self = circularRoot;

    const result = await resolveJSONPath({
      root: circularRoot,
      path: "$.nonExistent",
    });
    expect(result).toBe("");
  });

  it("should handle very deep nesting", async () => {
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

    const result = await resolveJSONPath({
      root: deepRoot,
      path: "$.level1.level2.level3.level4.level5",
    });
    expect(result).toBe("deep value");
  });

  it("should handle arrays in JSON paths", async () => {
    const arrayRoot = {
      items: [
        { id: 1, name: "first" },
        { id: 2, name: "second" },
      ],
    };

    const result = await resolveJSONPath({
      root: arrayRoot,
      path: "$.items[1].name",
    });
    expect(result).toBe("second");
  });

  it("should resolve repeat components in summary lists", async () => {
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

    const result = await resolveJSONPath({ root: mockRootWithActions, path });

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

  it("should resolve component-container with contentRef", async () => {
    const path = {
      component: "component-container",
      contentRef: "$.actionData.landGrants.response",
    };

    const result = await resolveJSONPath({ root: mockRoot, path });

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

  it("should return empty array for non-existent contentRef", async () => {
    const path = {
      component: "component-container",
      contentRef: "$.actionData.nonExistent",
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual([]);
  });

  it("should flatten component-container in arrays", async () => {
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

    const result = await resolveJSONPath({ root: mockRootWithSections, path });

    expect(result).toEqual([
      { component: "heading", text: "Title" },
      { component: "text", text: "Section 1" },
      { component: "text", text: "Section 2" },
    ]);
  });

  it("should handle component-container with nested components", async () => {
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

    const result = await resolveJSONPath({ root: mockRootWithNested, path });

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

  it("should handle empty component-container", async () => {
    const mockRootWithEmpty = {
      actionData: {
        emptyContent: [],
      },
    };

    const path = {
      component: "component-container",
      contentRef: "$.actionData.emptyContent",
    };

    const result = await resolveJSONPath({ root: mockRootWithEmpty, path });
    expect(result).toEqual([]);
  });
});

describe("conditional component resolution", () => {
  const mockRoot = {
    _id: "case-id-123",
    caseRef: "REF-001",
    request: {
      query: {
        runId: "run-123",
      },
    },
    payload: {
      isActive: true,
      status: "approved",
    },
  };

  it("should render whenTrue component when condition is true", async () => {
    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.isActive = true",
      whenTrue: {
        component: "text",
        text: "Active",
      },
      whenFalse: {
        component: "text",
        text: "Inactive",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "text",
      text: "Active",
    });
  });

  it("should render whenTrue when whenFalse is omitted", async () => {
    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.isActive = true",
      whenTrue: {
        component: "text",
        text: "Active",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "text",
      text: "Active",
    });
  });

  it("should render whenFalse component when condition is false", async () => {
    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.isActive = false",
      whenTrue: {
        component: "text",
        text: "Active",
      },
      whenFalse: {
        component: "text",
        text: "Inactive",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "text",
      text: "Inactive",
    });
  });

  it("should render whenFalse when whenTrue is omitted", async () => {
    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.isActive = false",
      whenFalse: {
        component: "text",
        text: "Inactive",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "text",
      text: "Inactive",
    });
  });

  it("should return undefined when condition resolves to a missing branch", async () => {
    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.isActive = false",
      whenTrue: {
        component: "text",
        text: "Active",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toBeUndefined();
  });

  it("should work with row context in table", async () => {
    const row = {
      id: "run-123",
      date: "2025-03-28T11:30:52.000Z",
    };

    const path = {
      component: "conditional",
      condition: "jsonata:$.request.query.runId = @.id",
      whenTrue: {
        component: "text",
        text: "Currently showing",
        classes: "govuk-body",
      },
      whenFalse: {
        component: "url",
        text: "View this version",
        href: {
          urlTemplate: "/cases/{caseId}/calculations?runId={runId}",
          params: {
            caseId: "$._id",
            runId: "@.id",
          },
        },
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path, row });
    expect(result).toEqual({
      component: "text",
      text: "Currently showing",
      classes: "govuk-body",
    });
  });

  it("should render url when runId does not match", async () => {
    const row = {
      id: "run-456",
      date: "2025-03-28T11:30:52.000Z",
    };

    const path = {
      component: "conditional",
      condition: "jsonata:$.request.query.runId = @.id",
      whenTrue: {
        component: "text",
        text: "Currently showing",
        classes: "govuk-body",
      },
      whenFalse: {
        component: "url",
        text: "View this version",
        href: {
          urlTemplate: "/cases/{caseId}/calculations?runId={runId}",
          params: {
            caseId: "$._id",
            runId: "@.id",
          },
        },
        target: "_self",
        classes: "govuk-link",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path, row });
    expect(result).toEqual({
      component: "url",
      text: "View this version",
      href: "/cases/case-id-123/calculations?runId=run-456",
      target: "_self",
      classes: "govuk-link",
    });
  });

  it("should handle conditional with string comparison", async () => {
    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.status = 'approved'",
      whenTrue: {
        component: "status",
        text: "Approved",
        classes: "govuk-tag--green",
      },
      whenFalse: {
        component: "status",
        text: "Pending",
        classes: "govuk-tag--yellow",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "status",
      text: "Approved",
      classes: "govuk-tag--green",
    });
  });

  it("should handle conditional with complex JSONata expressions", async () => {
    const mockRootWithData = {
      ...mockRoot,
      payload: {
        amount: 1500,
        threshold: 1000,
      },
    };

    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.amount > $.payload.threshold",
      whenTrue: {
        component: "text",
        text: "Above threshold",
      },
      whenFalse: {
        component: "text",
        text: "Below threshold",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithData, path });
    expect(result).toEqual({
      component: "text",
      text: "Above threshold",
    });
  });

  it("should handle nested conditionals", async () => {
    const mockRootWithNested = {
      ...mockRoot,
      payload: {
        level: 2,
      },
    };

    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.level > 1",
      whenTrue: {
        component: "conditional",
        condition: "jsonata:$.payload.level > 2",
        whenTrue: {
          component: "text",
          text: "Level 3+",
        },
        whenFalse: {
          component: "text",
          text: "Level 2",
        },
      },
      whenFalse: {
        component: "text",
        text: "Level 1",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithNested, path });
    expect(result).toEqual({
      component: "text",
      text: "Level 2",
    });
  });

  it("should resolve references in conditional branches", async () => {
    const path = {
      component: "conditional",
      condition: "jsonata:$.payload.isActive = true",
      whenTrue: {
        component: "text",
        text: "$.caseRef",
      },
      whenFalse: {
        component: "text",
        text: "No reference",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "text",
      text: "REF-001",
    });
  });

  it("should handle conditional with missing query parameters", async () => {
    const mockRootWithoutQuery = {
      _id: "case-id-123",
      request: {
        query: {},
      },
    };

    const row = {
      id: "run-123",
    };

    const path = {
      component: "conditional",
      condition: "jsonata:$.request.query.runId = @.id",
      whenTrue: {
        component: "text",
        text: "Currently showing",
      },
      whenFalse: {
        component: "text",
        text: "View version",
      },
    };

    const result = await resolveJSONPath({
      root: mockRootWithoutQuery,
      path,
      row,
    });
    expect(result).toEqual({
      component: "text",
      text: "View version",
    });
  });

  it("should handle conditional without row context", async () => {
    const path = {
      component: "conditional",
      condition: "jsonata:$.request.query.runId = 'run-123'",
      whenTrue: {
        component: "text",
        text: "Match found",
      },
      whenFalse: {
        component: "text",
        text: "No match",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "text",
      text: "Match found",
    });
  });

  it("should evaluate truthy JSONPath condition (like renderIf)", async () => {
    const mockRootWithData = {
      ...mockRoot,
      supplementaryData: {
        agreements: [{ id: 1 }, { id: 2 }],
      },
    };

    const path = {
      component: "conditional",
      condition: "$.supplementaryData.agreements[0]",
      whenTrue: {
        component: "text",
        text: "Has agreements",
      },
      whenFalse: {
        component: "text",
        text: "No agreements",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithData, path });
    expect(result).toEqual({
      component: "text",
      text: "Has agreements",
    });
  });

  it("should evaluate falsy JSONPath condition with empty array", async () => {
    const mockRootWithEmpty = {
      ...mockRoot,
      supplementaryData: {
        agreements: [],
      },
    };

    const path = {
      component: "conditional",
      condition: "$.supplementaryData.agreements[0]",
      whenTrue: {
        component: "text",
        text: "Has agreements",
      },
      whenFalse: {
        component: "text",
        text: "No agreements",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithEmpty, path });
    expect(result).toEqual({
      component: "text",
      text: "No agreements",
    });
  });

  it("should evaluate falsy JSONPath condition with undefined", async () => {
    const path = {
      component: "conditional",
      condition: "$.nonExistent.path",
      whenTrue: {
        component: "text",
        text: "Exists",
      },
      whenFalse: {
        component: "text",
        text: "Does not exist",
      },
    };

    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "text",
      text: "Does not exist",
    });
  });

  it("should evaluate truthy JSONPath condition with string", async () => {
    const mockRootWithString = {
      ...mockRoot,
      payload: {
        ...mockRoot.payload,
        message: "Hello World",
      },
    };

    const path = {
      component: "conditional",
      condition: "$.payload.message",
      whenTrue: {
        component: "text",
        text: "Has message",
      },
      whenFalse: {
        component: "text",
        text: "No message",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithString, path });
    expect(result).toEqual({
      component: "text",
      text: "Has message",
    });
  });

  it("should evaluate falsy JSONPath condition with empty string", async () => {
    const mockRootWithEmpty = {
      ...mockRoot,
      payload: {
        ...mockRoot.payload,
        message: "",
      },
    };

    const path = {
      component: "conditional",
      condition: "$.payload.message",
      whenTrue: {
        component: "text",
        text: "Has message",
      },
      whenFalse: {
        component: "text",
        text: "No message",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithEmpty, path });
    expect(result).toEqual({
      component: "text",
      text: "No message",
    });
  });

  it("should evaluate truthy condition with number", async () => {
    const mockRootWithNumber = {
      ...mockRoot,
      payload: {
        count: 5,
      },
    };

    const path = {
      component: "conditional",
      condition: "$.payload.count",
      whenTrue: {
        component: "text",
        text: "Has count",
      },
      whenFalse: {
        component: "text",
        text: "No count",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithNumber, path });
    expect(result).toEqual({
      component: "text",
      text: "Has count",
    });
  });

  it("should evaluate falsy condition with zero", async () => {
    const mockRootWithZero = {
      ...mockRoot,
      payload: {
        count: 0,
      },
    };

    const path = {
      component: "conditional",
      condition: "$.payload.count",
      whenTrue: {
        component: "text",
        text: "Has count",
      },
      whenFalse: {
        component: "text",
        text: "No count",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithZero, path });
    expect(result).toEqual({
      component: "text",
      text: "No count",
    });
  });

  it("should evaluate truthy condition with boolean true", async () => {
    const mockRootWithBool = {
      ...mockRoot,
      payload: {
        isActive: true,
      },
    };

    const path = {
      component: "conditional",
      condition: "$.payload.isActive",
      whenTrue: {
        component: "text",
        text: "Active",
      },
      whenFalse: {
        component: "text",
        text: "Inactive",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithBool, path });
    expect(result).toEqual({
      component: "text",
      text: "Active",
    });
  });

  it("should evaluate falsy condition with boolean false", async () => {
    const mockRootWithBool = {
      ...mockRoot,
      payload: {
        isActive: false,
      },
    };

    const path = {
      component: "conditional",
      condition: "$.payload.isActive",
      whenTrue: {
        component: "text",
        text: "Active",
      },
      whenFalse: {
        component: "text",
        text: "Inactive",
      },
    };

    const result = await resolveJSONPath({ root: mockRootWithBool, path });
    expect(result).toEqual({
      component: "text",
      text: "Inactive",
    });
  });

  it("should handle ternary operator in JSONata condition", async () => {
    const mockRootWithItems = {
      items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      request: {
        query: {
          selectedId: "2",
        },
      },
    };

    const row = { id: 2 };

    const path = {
      component: "conditional",
      condition:
        "jsonata:$.request.query.selectedId ? $number($.request.query.selectedId) = @.id : @.id = $.items[0].id",
      whenTrue: {
        component: "text",
        text: "Selected",
      },
      whenFalse: {
        component: "text",
        text: "Not selected",
      },
    };

    const result = await resolveJSONPath({
      root: mockRootWithItems,
      path,
      row,
    });
    expect(result).toEqual({
      component: "text",
      text: "Selected",
    });
  });

  it("should use fallback logic when query param is absent (ternary)", async () => {
    const mockRootWithItems = {
      items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      request: {
        query: {},
      },
    };

    const row = { id: 1 };

    const path = {
      component: "conditional",
      condition:
        "jsonata:$.request.query.selectedId ? $number($.request.query.selectedId) = @.id : @.id = $.items[0].id",
      whenTrue: {
        component: "text",
        text: "Selected",
      },
      whenFalse: {
        component: "text",
        text: "Not selected",
      },
    };

    const result = await resolveJSONPath({
      root: mockRootWithItems,
      path,
      row,
    });
    expect(result).toEqual({
      component: "text",
      text: "Selected",
    });
  });

  it("should use fallback logic correctly for non-first row", async () => {
    const mockRootWithItems = {
      items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      request: {
        query: {},
      },
    };

    const row = { id: 2 };

    const path = {
      component: "conditional",
      condition:
        "jsonata:$.request.query.selectedId ? $number($.request.query.selectedId) = @.id : @.id = $.items[0].id",
      whenTrue: {
        component: "text",
        text: "Selected",
      },
      whenFalse: {
        component: "text",
        text: "Not selected",
      },
    };

    const result = await resolveJSONPath({
      root: mockRootWithItems,
      path,
      row,
    });
    expect(result).toEqual({
      component: "text",
      text: "Not selected",
    });
  });

  it("should handle JSONata $number() errors gracefully with invalid string", async () => {
    const mockRootWithItems = {
      items: [{ id: 1 }, { id: 2 }, { id: 3 }],
      request: {
        query: {
          selectedId: "XXX", // Invalid string that cannot be converted to number
        },
      },
    };

    const row = { id: 2 };

    const path = {
      component: "conditional",
      condition:
        "jsonata:$.request.query.selectedId ? $number($.request.query.selectedId) = @.id : @.id = $.items[0].id",
      whenTrue: {
        component: "text",
        text: "Selected",
      },
      whenFalse: {
        component: "text",
        text: "Not selected",
      },
    };

    // Should not throw an error, but return undefined from the condition evaluation
    // which will evaluate to false, showing the whenFalse component
    const result = await resolveJSONPath({
      root: mockRootWithItems,
      path,
      row,
    });
    expect(result).toEqual({
      component: "text",
      text: "Not selected",
    });
  });

  it("should handle JSONata $number() errors gracefully without row reference", async () => {
    const mockRoot = {
      request: {
        query: {
          amount: "invalid", // Invalid string that cannot be converted to number
        },
      },
    };

    const path = {
      component: "conditional",
      condition: "jsonata:$number($.request.query.amount) > 100",
      whenTrue: {
        component: "text",
        text: "High amount",
      },
      whenFalse: {
        component: "text",
        text: "Low amount",
      },
    };

    // Should not throw an error, but return undefined from the condition evaluation
    // which will evaluate to false, showing the whenFalse component
    const result = await resolveJSONPath({ root: mockRoot, path });
    expect(result).toEqual({
      component: "text",
      text: "Low amount",
    });
  });

  it("should spread component-container when inside conditional in array", async () => {
    const mockRootWithData = {
      actionData: {
        rulesData: {
          response: [
            {
              component: "heading",
              text: "Land parcel calculations",
              level: 2,
            },
            {
              component: "text",
              text: "Some calculation data",
            },
          ],
        },
      },
    };

    const path = [
      {
        component: "heading",
        text: "Page Title",
        level: 1,
      },
      {
        component: "conditional",
        condition: "$.actionData.rulesData.response[0]",
        whenTrue: {
          component: "component-container",
          contentRef: "$.actionData.rulesData.response",
        },
        whenFalse: {
          component: "warning-text",
          text: "Failed to fetch land parcel calculations",
        },
      },
    ];

    const result = await resolveJSONPath({ root: mockRootWithData, path });

    expect(result).toEqual([
      {
        component: "heading",
        text: "Page Title",
        level: 1,
      },
      {
        component: "heading",
        text: "Land parcel calculations",
        level: 2,
      },
      {
        component: "text",
        text: "Some calculation data",
      },
    ]);
  });

  it("should not spread when conditional resolves to non-component array", async () => {
    const mockRootWithData = {
      items: ["item1", "item2", "item3"],
    };

    const path = [
      {
        component: "heading",
        text: "Title",
      },
      {
        component: "conditional",
        condition: "$.items[0]",
        whenTrue: "$.items",
        whenFalse: {
          component: "text",
          text: "No items",
        },
      },
    ];

    const result = await resolveJSONPath({ root: mockRootWithData, path });

    // The string array should not be spread, it should remain as a single array element
    expect(result).toEqual([
      {
        component: "heading",
        text: "Title",
      },
      ["item1", "item2", "item3"],
    ]);
  });
});
