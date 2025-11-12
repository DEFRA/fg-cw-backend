import { describe, expect, it } from "vitest";
import {
  assertPathExists,
  buildBanner,
  buildLinks,
  createRootContext,
  pathExists,
} from "./build-view-model.js";

describe("buildViewModel", () => {
  const knownLinks = [
    { id: "tasks", href: "/cases/case-123", text: "Tasks" },
    {
      id: "case-details",
      href: "/cases/case-123/case-details",
      text: "Case Details",
    },
    { id: "notes", href: "/cases/case-123/notes", text: "Notes" },
    { id: "timeline", href: "/cases/case-123/timeline", text: "Timeline" },
  ];

  describe("createRootContext", () => {
    const kase = {
      _id: "case-123",
      caseRef: "REF-001",
      status: "active",
    };
    const workflow = {
      code: "test-workflow",
      definitions: {
        apiUrl: "https://api.example.com",
        testKey: "testValue",
      },
    };
    it("should merge case and workflow definitions", () => {
      const result = createRootContext(kase, workflow);

      expect(result).toEqual({
        _id: "case-123",
        caseRef: "REF-001",
        status: "active",
        definitions: {
          apiUrl: "https://api.example.com",
          testKey: "testValue",
        },
      });
    });

    it("should handle workflow without definitions", () => {
      const kase = { _id: "case-123" };
      const workflow = { code: "test-workflow" };

      const result = createRootContext(kase, workflow);

      expect(result).toEqual({
        _id: "case-123",
        definitions: {},
      });
    });

    it("should handle empty workflow definitions", () => {
      const kase = { _id: "case-123" };
      const workflow = { code: "test-workflow", definitions: {} };

      const result = createRootContext(kase, workflow);

      expect(result).toEqual({
        _id: "case-123",
        definitions: {},
      });
    });

    it("should include externalActions from workflow", () => {
      const kase = { _id: "case-123" };
      const workflow = {
        code: "test-workflow",
        definitions: {},
        externalActions: [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
          },
        ],
      };

      const result = createRootContext(kase, workflow);

      expect(result).toEqual({
        _id: "case-123",
        definitions: {},
        externalActions: [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
          },
        ],
      });
    });
  });

  describe("pathExists", () => {
    const mockRoot = {
      _id: "case-123",
      payload: {
        businessName: "Test Business",
        identifiers: {
          sbi: "SBI001",
        },
      },
      supplementaryData: {
        agreements: [{ id: "agreement-1" }],
      },
    };

    it("should return true when path exists and resolves to truthy value", () => {
      expect(pathExists(mockRoot, "$.payload.businessName")).toBe(true);
      expect(pathExists(mockRoot, "$.supplementaryData.agreements[0]")).toBe(
        true,
      );
      expect(pathExists(mockRoot, "$._id")).toBe(true);
    });

    it("should return false when path exists but resolves to falsy value", () => {
      expect(pathExists(mockRoot, "$.nonexistent")).toBe(false);
      expect(pathExists(mockRoot, "$.payload.nonexistent")).toBe(false);
      expect(pathExists(mockRoot, "$.supplementaryData.agreements[5]")).toBe(
        false,
      );
    });

    it("should return true when path is null or undefined", () => {
      expect(pathExists(mockRoot, null)).toBe(true);
      expect(pathExists(mockRoot, undefined)).toBe(true);
      expect(pathExists(mockRoot, "")).toBe(true);
    });

    it("should return false for empty arrays", () => {
      const rootWithEmptyArray = {
        ...mockRoot,
        supplementaryData: { agreements: [] },
      };
      expect(
        pathExists(rootWithEmptyArray, "$.supplementaryData.agreements[0]"),
      ).toBe(false);
    });
  });

  describe("assertPathExists", () => {
    const mockRoot = {
      _id: "case-123",
      payload: {
        businessName: "Test Business",
      },
    };

    it("should not throw when path exists and resolves to truthy value", () => {
      expect(() =>
        assertPathExists(mockRoot, "$.payload.businessName"),
      ).not.toThrow();
      expect(() => assertPathExists(mockRoot, "$._id")).not.toThrow();
    });

    it("should not throw when path is null or undefined", () => {
      expect(() => assertPathExists(mockRoot, null)).not.toThrow();
      expect(() => assertPathExists(mockRoot, undefined)).not.toThrow();
      expect(() => assertPathExists(mockRoot, "")).not.toThrow();
    });

    it("should throw when path resolves to falsy value", () => {
      expect(() => assertPathExists(mockRoot, "$.nonexistent")).toThrow(
        "Path does not exist, $.nonexistent resolves to falsy value",
      );
      expect(() => assertPathExists(mockRoot, "$.payload.nonexistent")).toThrow(
        "Path does not exist, $.payload.nonexistent resolves to falsy value",
      );
    });

    it("should throw with correct error message", () => {
      const customPath = "$.some.custom.path";
      expect(() => assertPathExists(mockRoot, customPath)).toThrow(
        `Path does not exist, ${customPath} resolves to falsy value`,
      );
    });
  });

  describe("buildLinks", () => {
    const mockCase = {
      _id: "case-123",
      caseRef: "REF-001",
    };

    const mockWorkflow = {
      code: "test-workflow",
      pages: {
        cases: {
          details: {
            tabs: {
              agreements: {
                renderIf: "$.supplementaryData.agreements[0]",
              },
              "custom-tab": {
                // Tab without renderIf condition
              },
            },
          },
        },
      },
      definitions: {},
    };

    it("should build default links plus workflow tab links", () => {
      const result = buildLinks(mockCase, mockWorkflow);

      expect(result).toEqual([
        ...knownLinks,
        {
          id: "custom-tab",
          href: "/cases/case-123/custom-tab",
          text: "Custom Tab",
        },
      ]);
    });

    it("should handle workflow without tab definitions", () => {
      const workflowWithoutTabs = {
        code: "minimal-workflow",
        pages: {
          cases: {
            details: {},
          },
        },
        definitions: {},
      };

      expect(buildLinks(mockCase, workflowWithoutTabs)).toStrictEqual(
        knownLinks,
      );
    });

    it("should handle case with agreements that should render", () => {
      const caseWithAgreements = {
        ...mockCase,
        supplementaryData: { agreements: [{ id: "agreement-1" }] },
      };

      const result = buildLinks(caseWithAgreements, mockWorkflow);

      expect(result.find((link) => link.id === "agreements")).toEqual({
        id: "agreements",
        href: "/cases/case-123/agreements",
        text: "Agreements",
      });
    });

    it("should filter out known link ids from tabs", () => {
      const workflowWithKnownIds = {
        code: "test-workflow",
        pages: {
          cases: {
            details: {
              tabs: {
                tasks: {
                  // This should be filtered out since "tasks" is a known link id
                },
                notes: {
                  // This should be filtered out since "notes" is a known link id
                },
                "new-tab": {
                  // This should be included
                },
              },
            },
          },
        },
        definitions: {},
      };

      const result = buildLinks(mockCase, workflowWithKnownIds);

      expect(result.find((link) => link.id === "new-tab")).toBeDefined();
      // Should not have duplicate tasks or notes links
      expect(result.filter((link) => link.id === "tasks")).toHaveLength(1);
      expect(result.filter((link) => link.id === "notes")).toHaveLength(1);
    });

    it("should handle workflow with empty tabs object", () => {
      const workflowWithEmptyTabs = {
        code: "test-workflow",
        pages: {
          cases: {
            details: {
              tabs: {},
            },
          },
        },
        definitions: {},
      };

      const result = buildLinks(mockCase, workflowWithEmptyTabs);

      expect(result).toEqual(knownLinks);
    });
  });

  describe("idToText helper", () => {
    // Test idToText indirectly through buildLinks since it's not exported
    const mockCase = {
      _id: "case-123",
      caseRef: "REF-001",
    };

    it("should convert kebab-case ids to title case", () => {
      const workflowWithKebabCaseTab = {
        code: "test-workflow",
        pages: {
          cases: {
            details: {
              tabs: {
                "multi-word-tab": {},
              },
            },
          },
        },
        definitions: {},
      };

      const result = buildLinks(mockCase, workflowWithKebabCaseTab);
      const tabLink = result.find((link) => link.id === "multi-word-tab");

      expect(tabLink.text).toBe("Multi Word Tab");
    });

    it("should handle single word ids", () => {
      const workflowWithSingleWordTab = {
        code: "test-workflow",
        pages: {
          cases: {
            details: {
              tabs: {
                documents: {},
              },
            },
          },
        },
        definitions: {},
      };

      const result = buildLinks(mockCase, workflowWithSingleWordTab);
      const tabLink = result.find((link) => link.id === "documents");

      expect(tabLink.text).toBe("Documents");
    });

    it("should handle complex kebab-case ids", () => {
      const workflowWithComplexTab = {
        code: "test-workflow",
        pages: {
          cases: {
            details: {
              tabs: {
                "very-long-tab-name-here": {},
              },
            },
          },
        },
        definitions: {},
      };

      const result = buildLinks(mockCase, workflowWithComplexTab);
      const tabLink = result.find(
        (link) => link.id === "very-long-tab-name-here",
      );

      expect(tabLink.text).toBe("Very Long Tab Name Here");
    });
  });

  describe("buildBanner", () => {
    const mockCase = {
      _id: "case-123",
      caseRef: "REF-001",
      payload: {
        businessName: "Test Business Ltd",
        identifiers: {
          sbi: "SBI001",
        },
      },
    };

    const mockWorkflow = {
      code: "test-workflow",
      pages: {
        cases: {
          details: {
            banner: {
              title: {
                text: "$.payload.businessName",
                type: "string",
              },
              summary: {
                reference: {
                  label: "Reference",
                  text: "$.caseRef",
                  type: "string",
                },
                sbi: {
                  label: "SBI",
                  text: "$.payload.identifiers.sbi",
                  type: "string",
                },
              },
            },
          },
        },
      },
      definitions: {
        apiUrl: "https://api.example.com",
      },
    };

    it("should build banner with resolved values", () => {
      const result = buildBanner(mockCase, mockWorkflow);

      expect(result).toEqual({
        title: {
          text: "Test Business Ltd",
          type: "string",
        },
        summary: {
          reference: {
            label: "Reference",
            text: "REF-001",
            type: "string",
          },
          sbi: {
            label: "SBI",
            text: "SBI001",
            type: "string",
          },
        },
      });
    });

    it("should handle missing banner configuration", () => {
      const workflowWithoutBanner = {
        code: "minimal-workflow",
        pages: {
          cases: {
            details: {},
          },
        },
        definitions: {},
      };

      const result = buildBanner(mockCase, workflowWithoutBanner);

      expect(result).toBeUndefined();
    });

    it("should include callToAction from externalActions", () => {
      const workflowWithExternalActions = {
        ...mockWorkflow,
        externalActions: [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            description: "Rerun the business rules validation",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "array",
              place: "append",
            },
          },
          {
            code: "ANOTHER_ACTION",
            name: "Another Action",
            endpoint: "anotherEndpoint",
          },
        ],
      };

      const result = buildBanner(mockCase, workflowWithExternalActions);

      expect(result.callToAction).toEqual([
        {
          code: "RERUN_RULES",
          name: "Rerun Rules",
        },
        {
          code: "ANOTHER_ACTION",
          name: "Another Action",
        },
      ]);
    });

    it("should handle banner with complex nested structure", () => {
      const complexWorkflow = {
        ...mockWorkflow,
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                  type: "string",
                },
                summary: {
                  reference: {
                    label: "Reference",
                    text: "$.caseRef",
                    type: "string",
                  },
                  nested: {
                    deep: {
                      value: {
                        label: "Deep Value",
                        text: "$.payload.identifiers.sbi",
                        type: "string",
                      },
                    },
                  },
                },
                metadata: {
                  definitions: "$.definitions.apiUrl",
                },
              },
            },
          },
        },
      };

      const result = buildBanner(mockCase, complexWorkflow);

      expect(result.callToAction).toBeUndefined();
      expect(result.summary.nested.deep.value).toEqual({
        label: "Deep Value",
        text: "SBI001",
        type: "string",
      });
      expect(result.metadata.definitions).toBe("https://api.example.com");
    });
  });
});
