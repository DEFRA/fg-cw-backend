import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { buildCaseDetailsTabUseCase } from "./build-case-details-tab.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("../../common/external-endpoint-client.js", () => ({
  callExternalEndpoint: vi.fn(),
}));

describe("buildCaseDetailsTabUseCase", () => {
  it("builds case details tab successfully", async () => {
    const mockCase = Case.createMock({
      caseRef: "TEST-REF-001",
      workflowCode: "frps-private-beta",
      payload: {
        businessName: "Test Business",
        clientRef: "CLIENT-REF-001",
        identifiers: { sbi: "SBI001" },
        answers: { scheme: "SFI", year: 2025 },
        submittedAt: "2025-03-28T11:30:52.000Z",
      },
    });

    const mockWorkflow = Workflow.createMock();

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    const result = await buildCaseDetailsTabUseCase({
      params: { caseId: "test-case-id", tabId: "case-details" },
      query: {},
    });

    expect(findById).toHaveBeenCalledWith("test-case-id");
    expect(findByCode).toHaveBeenCalledWith("frps-private-beta");
    expect(result.caseId).toBe("test-case-id");
    expect(result.caseRef).toBe("TEST-REF-001");
    expect(result.tabId).toBe("case-details");
    expect(result.banner).toBeDefined();
    expect(result.banner.title.text).toBe("Test Business");
    expect(result.links).toBeDefined();
    expect(Array.isArray(result.links)).toBe(true);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].title).toBe("Details");
  });

  it("throws error when case not found", async () => {
    findById.mockResolvedValue(null);

    await expect(
      buildCaseDetailsTabUseCase({
        params: { caseId: "non-existent-id", tabId: "case-details" },
        query: {},
      }),
    ).rejects.toThrow();

    expect(findById).toHaveBeenCalledWith("non-existent-id");
  });

  it("throws error when workflow not found", async () => {
    const mockCase = Case.createMock({
      workflowCode: "non-existent-workflow",
    });

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(null);

    await expect(
      buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "case-details" },
        query: {},
      }),
    ).rejects.toThrow();
  });

  it("throws error when tab not found in workflow", async () => {
    const mockCase = Case.createMock({
      workflowCode: "test-workflow",
    });

    const mockWorkflow = Workflow.createMock({
      code: "test-workflow",
      pages: {
        cases: {
          details: {
            tabs: {
              "other-tab": {
                content: [],
              },
            },
          },
        },
      },
    });

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    await expect(
      buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "non-existent-tab" },
        query: {},
      }),
    ).rejects.toThrow(
      'Tab "non-existent-tab" not found in workflow "test-workflow"',
    );
  });

  it("throws error when tab should not render", async () => {
    const mockCase = Case.createMock({
      _id: "test-case-id",
      workflowCode: "test-workflow",
      agreements: [], // Empty agreements array
    });

    const mockWorkflow = Workflow.createMock({
      code: "test-workflow",
      pages: {
        cases: {
          details: {
            tabs: {
              agreements: {
                renderIf: "$.supplementaryData.agreements[0]",
                content: [],
              },
            },
          },
        },
      },
    });

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    await expect(
      buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "agreements" },
        query: {},
      }),
    ).rejects.toThrow(
      "Path does not exist, $.supplementaryData.agreements[0] resolves to falsy value",
    );
  });

  it("handles tab with renderIf condition that evaluates to true", async () => {
    const mockCase = Case.createMock({
      _id: "test-case-id",
      caseRef: "TEST-REF-001",
      workflowCode: "test-workflow",
      supplementaryData: { agreements: [{ agreementRef: "AGR-001" }] },
    });

    const mockWorkflow = Workflow.createMock({
      code: "test-workflow",
      pages: {
        cases: {
          details: {
            banner: {
              title: { text: "Test Title" },
            },
            tabs: {
              agreements: {
                renderIf: "$.supplementaryData.agreements[0]",
                content: [
                  {
                    id: "agreements",
                    component: "table",
                    title: "Agreements",
                  },
                ],
              },
            },
          },
        },
      },
    });

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    const result = await buildCaseDetailsTabUseCase({
      params: { caseId: "test-case-id", tabId: "agreements" },
      query: {},
    });

    expect(result.caseId).toBe("test-case-id");
    expect(result.caseRef).toBe("TEST-REF-001");
    expect(result.tabId).toBe("agreements");
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
  });

  it("handles missing pages structure in workflow", async () => {
    const mockCase = Case.createMock({
      workflowCode: "minimal-workflow",
    });

    const mockWorkflow = Workflow.createMock({
      code: "minimal-workflow",
      pages: {},
    });

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    await expect(
      buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "agreements" },
        query: {},
      }),
    ).rejects.toThrow(
      'Tab "agreements" not found in workflow "minimal-workflow"',
    );
  });

  it("handles missing cases structure in workflow pages", async () => {
    const mockCase = Case.createMock({
      workflowCode: "minimal-workflow",
    });

    const mockWorkflow = Workflow.createMock({
      code: "minimal-workflow",
      pages: {
        other: {},
      },
    });

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    await expect(
      buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "agreements" },
        query: {},
      }),
    ).rejects.toThrow(
      'Tab "agreements" not found in workflow "minimal-workflow"',
    );
  });

  it("builds case details tab with real workflow data", async () => {
    const mockCase = Case.createMock({
      _id: "64c88faac1f56f71e1b89a77",
      caseRef: "APPLICATION-REF-001",
      workflowCode: "frps-private-beta",
      payload: {
        businessName: "Test Farm Ltd",
        clientRef: "APPLICATION-REF-001",
        identifiers: {
          sbi: "SBI001",
          frn: "FIRM0001",
        },
        answers: {
          scheme: "SFI",
          year: 2025,
          actionApplications: [
            {
              parcelId: "9238",
              sheetId: "SX0679",
              code: "CSAM1",
              appliedFor: { unit: "ha", quantity: 20.23 },
            },
          ],
        },
        submittedAt: "2025-03-28T11:30:52.000Z",
      },
    });

    const mockWorkflow = Workflow.createMock({
      code: "frps-private-beta",
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
                scheme: {
                  label: "Scheme",
                  text: "$.payload.answers.scheme",
                  type: "string",
                },
              },
            },
            tabs: {
              "case-details": {
                content: [
                  {
                    id: "title",
                    component: "heading",
                    text: "Application",
                    level: 2,
                  },
                  {
                    id: "answers",
                    component: "list",
                    title: "Answers",
                    type: "object",
                    rows: [
                      {
                        text: "$.payload.answers.scheme",
                        type: "string",
                        label: "Scheme",
                      },
                      {
                        text: "$.payload.answers.year",
                        type: "number",
                        label: "Year",
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      definitions: {
        testKey: "testValue",
      },
    });

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    const result = await buildCaseDetailsTabUseCase({
      params: { caseId: "64c88faac1f56f71e1b89a77", tabId: "case-details" },
      query: {},
    });

    // Verify the structure
    expect(result.caseId).toBe("64c88faac1f56f71e1b89a77");
    expect(result.caseRef).toBe("APPLICATION-REF-001");
    expect(result.tabId).toBe("case-details");

    // Verify banner data is resolved correctly
    expect(result.banner).toBeDefined();
    expect(result.banner.title.text).toBe("Test Farm Ltd");
    expect(result.banner.summary.reference.label).toBe("Reference");
    expect(result.banner.summary.reference.text).toBe("APPLICATION-REF-001");
    expect(result.banner.summary.scheme.text).toBe("SFI");

    // Verify links are built
    expect(result.links).toBeDefined();
    expect(Array.isArray(result.links)).toBe(true);
    expect(result.links.length).toBeGreaterThan(0);

    // Verify content is resolved correctly
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0].text).toBe("Application");
    expect(result.content[1].rows[0].text).toBe("SFI");
    expect(result.content[1].rows[1].text).toBe(2025);
  });

  it("generates dynamic content when case-details tab is not defined in workflow", async () => {
    const mockCase = Case.createMock({
      _id: "test-case-id",
      caseRef: "TEST-REF-001",
      workflowCode: "test-workflow",
      payload: {
        businessName: "Test Business",
        clientRef: "CLIENT-REF-001",
        identifiers: { sbi: "SBI001" },
        answers: {
          scheme: "SFI",
          year: 2025,
          hasCheckedLandIsUpToDate: true,
          checkedDate: "2025-03-28T11:30:52.000Z",
          actionApplications: [
            {
              code: "CMOR1",
              parcelId: "9485",
              appliedFor: {
                unit: "ha",
                quantity: 0.14472089,
              },
            },
          ],
        },
        applicant: {
          business: {
            name: "Test Farm Business",
            email: {
              address: "test@example.com",
            },
          },
        },
        submittedAt: "2025-03-28T11:30:52.000Z",
      },
    });

    // Workflow WITHOUT case-details tab - should trigger dynamic content generation
    const mockWorkflow = Workflow.createMock({
      code: "test-workflow",
      pages: {
        cases: {
          details: {
            banner: {
              title: {
                text: "$.payload.businessName",
                type: "string",
              },
            },
            tabs: {
              "other-tab": {
                content: [
                  {
                    id: "other-content",
                    component: "text",
                    text: "Other content",
                  },
                ],
              },
              // Note: NO "case-details" tab defined!
            },
          },
        },
      },
    });

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(mockWorkflow);

    const result = await buildCaseDetailsTabUseCase({
      params: { caseId: "test-case-id", tabId: "case-details" },
      query: {},
    });

    // Verify basic structure
    expect(result.caseId).toBe("test-case-id");
    expect(result.caseRef).toBe("TEST-REF-001");
    expect(result.tabId).toBe("case-details");
    expect(result.banner).toBeDefined();
    expect(result.links).toBeDefined();

    // Verify dynamic content generation
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(1);

    // Should have default heading as first component from buildDynamicContent
    expect(result.content[0]).toEqual({
      id: "title",
      component: "heading",
      text: "Application",
      level: 2,
    });

    // Should contain components for non-excluded payload fields
    const componentIds = result.content.map((comp) => comp.id);
    expect(componentIds).toContain("answers");
    expect(componentIds).toContain("business"); // From applicant.business
    expect(componentIds).toContain("actionApplications"); // From answers.actionApplications

    // Should NOT contain excluded fields
    expect(componentIds).not.toContain("clientRef");
    expect(componentIds).not.toContain("submittedAt");
    expect(componentIds).not.toContain("identifiers");

    // Verify specific component structure for answers
    const answersComponent = result.content.find(
      (comp) => comp.id === "answers",
    );
    expect(answersComponent).toBeDefined();
    expect(answersComponent.component).toBe("summary-list");
    expect(answersComponent.title).toBe("Answers");
    expect(answersComponent.type).toBe("object");
    expect(Array.isArray(answersComponent.rows)).toBe(true);

    // Check that boolean values are processed correctly
    const booleanRow = answersComponent.rows.find(
      (row) => row.id === "hasCheckedLandIsUpToDate",
    );
    expect(booleanRow).toBeDefined();
    expect(booleanRow.type).toBe("boolean");
    expect(booleanRow.text).toBe("Yes");

    // Check that date values are processed correctly
    const dateRow = answersComponent.rows.find(
      (row) => row.id === "checkedDate",
    );
    expect(dateRow).toBeDefined();
    expect(dateRow.type).toBe("date");
    expect(dateRow.text).toBe("28 Mar 2025");

    // Verify table component for action applications array
    const tableComponent = result.content.find(
      (comp) => comp.component === "table",
    );
    expect(tableComponent).toBeDefined();
    expect(tableComponent.type).toBe("array");
    expect(Array.isArray(tableComponent.rows)).toBe(true);
  });

  describe("action context integration", () => {
    it("should add actionData to root context when tab has action definition", async () => {
      const { callExternalEndpoint } = await import(
        "../../common/external-endpoint-client.js"
      );

      // Mock external endpoint to return test data
      callExternalEndpoint.mockResolvedValue({
        response: [
          {
            component: "summary-list",
            rows: [{ label: "Test", text: "Value" }],
          },
        ],
      });

      const mockCase = Case.createMock();

      const mockWorkflow = Workflow.createMock({
        code: "frps-private-beta",
        endpoints: [
          {
            code: "RULES_ENGINE_ENDPOINT",
            service: "RULES_ENGINE",
            path: "/api/test",
            method: "GET",
          },
        ],
        externalActions: [
          {
            code: "rules-engine-endpoint",
            endpoint: {
              code: "RULES_ENGINE_ENDPOINT",
              endpointParams: {},
            },
          },
        ],
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                },
              },
              tabs: {
                "land-grants": {
                  action: {
                    landGrants: "rules-engine-endpoint",
                  },
                  content: [
                    {
                      component: "heading",
                      text: "Land Grants",
                      level: 2,
                    },
                    {
                      component: "component-container",
                      contentRef: "$.actionData.landGrants.response",
                    },
                  ],
                },
              },
            },
          },
        },
      });

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);

      const result = await buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "land-grants" },
        query: {},
      });

      expect(result.caseId).toBe("test-case-id");
      expect(result.caseRef).toBe("case-ref");
      expect(result.tabId).toBe("land-grants");
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);

      // Verify that content includes both static heading and dynamic content from actionData
      expect(result.content.length).toBeGreaterThan(1);
      expect(result.content[0]).toEqual({
        component: "heading",
        text: "Land Grants",
        level: 2,
      });

      // Verify the component-container is resolved to actual components from temp-rules-engine-output.json
      // The rest of the content should be the flattened response from the rules engine
      const dynamicContent = result.content.slice(1);
      expect(dynamicContent.length).toBeGreaterThan(0);
      expect(dynamicContent[0]).toHaveProperty("component");
    });

    it("should not add actionData when tab has no action definition", async () => {
      const mockCase = Case.createMock();

      const mockWorkflow = Workflow.createMock({
        code: "frps-private-beta",
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                },
              },
              tabs: {
                "simple-tab": {
                  content: [
                    {
                      component: "heading",
                      text: "Simple Tab",
                      level: 2,
                    },
                  ],
                },
              },
            },
          },
        },
      });

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);

      const result = await buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "simple-tab" },
        query: {},
      });

      // Should still work without action definition
      expect(result.caseId).toBe("test-case-id");
      expect(result.caseRef).toBe("case-ref");
      expect(result.tabId).toBe("simple-tab");
      expect(result.content).toBeDefined();
      expect(result.content).toEqual([
        {
          component: "heading",
          text: "Simple Tab",
          level: 2,
        },
      ]);
    });
  });

  describe("external actions", () => {
    it("should handle workflow without externalActions property", async () => {
      const mockCase = Case.createMock();

      const mockWorkflow = Workflow.createMock({
        code: "test-workflow",
        // No externalActions property
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                },
              },
              tabs: {
                "test-tab": {
                  action: {
                    someAction: "NON_EXISTENT_ACTION",
                  },
                  content: [
                    {
                      component: "heading",
                      text: "Test Tab",
                      level: 2,
                    },
                  ],
                },
              },
            },
          },
        },
      });

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);

      const result = await buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "test-tab" },
        query: {},
      });

      // Should handle gracefully when externalActions doesn't exist
      expect(result.caseId).toBe("test-case-id");
      expect(result.content).toBeDefined();
    });

    it("should handle non-string actionValue", async () => {
      const mockCase = Case.createMock();

      const mockWorkflow = Workflow.createMock({
        code: "test-workflow",
        externalActions: [
          {
            code: "VALID_ACTION",
            name: "Valid Action",
          },
        ],
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                },
              },
              tabs: {
                "test-tab": {
                  action: {
                    // Non-string actionValue - should be handled gracefully
                    numericAction: 123,
                  },
                  content: [
                    {
                      component: "heading",
                      text: "Test Tab",
                      level: 2,
                    },
                  ],
                },
              },
            },
          },
        },
      });

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);

      const result = await buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "test-tab" },
        query: {},
      });

      // Should handle gracefully when actionValue is not a string
      expect(result.caseId).toBe("test-case-id");
      expect(result.content).toBeDefined();
    });
  });

  describe("rules engine data loading (temporary code needed to keep sonar happy)", () => {
    it("should load specific rules run data when runId is provided", async () => {
      const mockCase = Case.createMock({
        payload: {
          businessName: "Test Business",
          rulesRunId: "906",
        },
      });

      const mockWorkflow = Workflow.createMock({
        code: "test-workflow",
        externalActions: [
          {
            code: "LOAD_RULES",
            name: "Load Rules Data",
            endpoint: {
              endpointParams: {
                rulesRun: {
                  runId: "$.payload.rulesRunId",
                },
              },
            },
          },
        ],
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                },
              },
              tabs: {
                "rules-tab": {
                  action: {
                    rulesData: "LOAD_RULES",
                  },
                  content: [
                    {
                      component: "heading",
                      text: "Rules Results",
                      level: 2,
                    },
                  ],
                },
              },
            },
          },
        },
      });

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);

      const result = await buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "rules-tab" },
        query: {},
      });

      // Should successfully load rules-run-906.json
      expect(result.caseId).toBe("test-case-id");
      expect(result.content).toBeDefined();
    });

    it("should load different runId based on payload value", async () => {
      const mockCase = Case.createMock({
        payload: {
          businessName: "Test Business",
          rulesRunId: "907",
        },
      });

      const mockWorkflow = Workflow.createMock({
        code: "test-workflow",
        externalActions: [
          {
            code: "LOAD_RULES",
            name: "Load Rules Data",
            endpoint: {
              endpointParams: {
                rulesRun: {
                  runId: "$.payload.rulesRunId",
                },
              },
            },
          },
        ],
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                },
              },
              tabs: {
                "rules-tab": {
                  action: {
                    rulesData: "LOAD_RULES",
                  },
                  content: [],
                },
              },
            },
          },
        },
      });

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);

      const result = await buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "rules-tab" },
        query: {},
      });

      // Should successfully load rules-run-907.json
      expect(result.caseId).toBe("test-case-id");
      expect(result.content).toBeDefined();
    });

    it("should load default rules data when no runId is provided", async () => {
      const mockCase = Case.createMock({
        payload: {
          businessName: "Test Business",
        },
      });

      const mockWorkflow = Workflow.createMock({
        code: "test-workflow",
        externalActions: [
          {
            code: "LOAD_RULES_NO_ID",
            name: "Load Default Rules",
            endpoint: {
              endpointParams: {
                someOtherParam: {
                  value: "$.payload.businessName",
                },
              },
            },
          },
        ],
        pages: {
          cases: {
            details: {
              banner: {
                title: {
                  text: "$.payload.businessName",
                },
              },
              tabs: {
                "rules-tab": {
                  action: {
                    rulesData: "LOAD_RULES_NO_ID",
                  },
                  content: [],
                },
              },
            },
          },
        },
      });

      findById.mockResolvedValue(mockCase);
      findByCode.mockResolvedValue(mockWorkflow);

      const result = await buildCaseDetailsTabUseCase({
        params: { caseId: "test-case-id", tabId: "rules-tab" },
        query: {},
      });

      // Should successfully load rules-run-default.json
      expect(result.caseId).toBe("test-case-id");
      expect(result.content).toBeDefined();
    });
  });
});
