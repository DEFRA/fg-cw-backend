import { describe, expect, it } from "vitest";
import {
  assertPathExists,
  buildBanner,
  buildLinks,
  createCaseWorkflowContext,
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
    it("should merge case and workflow definitions", async () => {
      const result = createCaseWorkflowContext(kase, workflow);

      expect(result).toEqual({
        _id: "case-123",
        caseRef: "REF-001",
        status: "active",
        definitions: {
          apiUrl: "https://api.example.com",
          testKey: "testValue",
        },
        request: {},
      });
    });

    it("should handle workflow without definitions", async () => {
      const kase = { _id: "case-123" };
      const workflow = { code: "test-workflow" };

      const result = createCaseWorkflowContext(kase, workflow);

      expect(result).toEqual({
        _id: "case-123",
        definitions: {},
        request: {},
      });
    });

    it("should handle empty workflow definitions", async () => {
      const kase = { _id: "case-123" };
      const workflow = { code: "test-workflow", definitions: {} };

      const result = createCaseWorkflowContext(kase, workflow);

      expect(result).toEqual({
        _id: "case-123",
        definitions: {},
        request: {},
      });
    });

    it("should include externalActions from workflow", async () => {
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

      const result = createCaseWorkflowContext(kase, workflow);

      expect(result).toEqual({
        _id: "case-123",
        definitions: {},
        request: {},
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

    it("should return true when path exists and resolves to truthy value", async () => {
      expect(await pathExists(mockRoot, "$.payload.businessName")).toBe(true);
      expect(
        await pathExists(mockRoot, "$.supplementaryData.agreements[0]"),
      ).toBe(true);
      expect(await pathExists(mockRoot, "$._id")).toBe(true);
    });

    it("should return false when path exists but resolves to falsy value", async () => {
      expect(await pathExists(mockRoot, "$.nonexistent")).toBe(false);
      expect(await pathExists(mockRoot, "$.payload.nonexistent")).toBe(false);
      expect(
        await pathExists(mockRoot, "$.supplementaryData.agreements[5]"),
      ).toBe(false);
    });

    it("should return true when path is null or undefined", async () => {
      expect(await pathExists(mockRoot, null)).toBe(true);
      expect(await pathExists(mockRoot, undefined)).toBe(true);
      expect(await pathExists(mockRoot, "")).toBe(true);
    });

    it("should return false for empty arrays", async () => {
      const rootWithEmptyArray = {
        ...mockRoot,
        supplementaryData: { agreements: [] },
      };
      expect(
        await pathExists(
          rootWithEmptyArray,
          "$.supplementaryData.agreements[0]",
        ),
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

    it("should not throw when path exists and resolves to truthy value", async () => {
      await expect(
        assertPathExists(mockRoot, "$.payload.businessName"),
      ).resolves.not.toThrow();
      await expect(assertPathExists(mockRoot, "$._id")).resolves.not.toThrow();
    });

    it("should not throw when path is null or undefined", async () => {
      await expect(assertPathExists(mockRoot, null)).resolves.not.toThrow();
      await expect(
        assertPathExists(mockRoot, undefined),
      ).resolves.not.toThrow();
      await expect(assertPathExists(mockRoot, "")).resolves.not.toThrow();
    });

    it("should throw when path resolves to falsy value", async () => {
      await expect(assertPathExists(mockRoot, "$.nonexistent")).rejects.toThrow(
        "Path does not exist, $.nonexistent resolves to falsy value",
      );
      await expect(
        assertPathExists(mockRoot, "$.payload.nonexistent"),
      ).rejects.toThrow(
        "Path does not exist, $.payload.nonexistent resolves to falsy value",
      );
    });

    it("should throw with correct error message", async () => {
      const customPath = "$.some.custom.path";
      await expect(assertPathExists(mockRoot, customPath)).rejects.toThrow(
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

    it("should build default links plus workflow tab links", async () => {
      const result = await buildLinks(mockCase, mockWorkflow);

      expect(result).toEqual([
        ...knownLinks,
        {
          id: "custom-tab",
          href: "/cases/case-123/custom-tab",
          text: "Custom Tab",
        },
      ]);
    });

    it("should handle workflow without tab definitions", async () => {
      const workflowWithoutTabs = {
        code: "minimal-workflow",
        pages: {
          cases: {
            details: {},
          },
        },
        definitions: {},
      };

      expect(await buildLinks(mockCase, workflowWithoutTabs)).toStrictEqual(
        knownLinks,
      );
    });

    it("should handle case with agreements that should render", async () => {
      const caseWithAgreements = {
        ...mockCase,
        supplementaryData: { agreements: [{ id: "agreement-1" }] },
      };

      const result = await buildLinks(caseWithAgreements, mockWorkflow);

      expect(result.find((link) => link.id === "agreements")).toEqual({
        id: "agreements",
        href: "/cases/case-123/agreements",
        text: "Agreements",
      });
    });

    it("should filter out known link ids from tabs", async () => {
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

      const result = await buildLinks(mockCase, workflowWithKnownIds);

      expect(result.find((link) => link.id === "new-tab")).toBeDefined();
      // Should not have duplicate tasks or notes links
      expect(result.filter((link) => link.id === "tasks")).toHaveLength(1);
      expect(result.filter((link) => link.id === "notes")).toHaveLength(1);
    });

    it("should handle workflow with empty tabs object", async () => {
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

      const result = await buildLinks(mockCase, workflowWithEmptyTabs);

      expect(result).toEqual(knownLinks);
    });
  });

  describe("idToText helper", () => {
    // Test idToText indirectly through buildLinks since it's not exported
    const mockCase = {
      _id: "case-123",
      caseRef: "REF-001",
    };

    it("should convert kebab-case ids to title case", async () => {
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

      const result = await buildLinks(mockCase, workflowWithKebabCaseTab);
      const tabLink = result.find((link) => link.id === "multi-word-tab");

      expect(tabLink.text).toBe("Multi Word Tab");
    });

    it("should handle single word ids", async () => {
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

      const result = await buildLinks(mockCase, workflowWithSingleWordTab);
      const tabLink = result.find((link) => link.id === "documents");

      expect(tabLink.text).toBe("Documents");
    });

    it("should handle complex kebab-case ids", async () => {
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

      const result = await buildLinks(mockCase, workflowWithComplexTab);
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

    it("should build banner with resolved values", async () => {
      const result = await buildBanner(mockCase, mockWorkflow);

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

    it("should handle missing banner configuration", async () => {
      const workflowWithoutBanner = {
        code: "minimal-workflow",
        pages: {
          cases: {
            details: {},
          },
        },
        definitions: {},
      };

      const result = await buildBanner(mockCase, workflowWithoutBanner);

      expect(result).toBeUndefined();
    });

    it("should include callToAction from externalActions", async () => {
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

      const result = await buildBanner(mockCase, workflowWithExternalActions);

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

    it("should handle banner with complex nested structure", async () => {
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

      const result = await buildBanner(mockCase, complexWorkflow);

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
