import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { buildCaseDetailsTabUseCase } from "./build-case-details-tab.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");

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

    const result = await buildCaseDetailsTabUseCase(
      "test-case-id",
      "case-details",
    );

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
      buildCaseDetailsTabUseCase("non-existent-id", "case-details"),
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
      buildCaseDetailsTabUseCase("test-case-id", "case-details"),
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
      buildCaseDetailsTabUseCase("test-case-id", "non-existent-tab"),
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
      buildCaseDetailsTabUseCase("test-case-id", "agreements"),
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

    const result = await buildCaseDetailsTabUseCase(
      "test-case-id",
      "agreements",
    );

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
      buildCaseDetailsTabUseCase("test-case-id", "agreements"),
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
      buildCaseDetailsTabUseCase("test-case-id", "agreements"),
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
          agreementName: "Test SFI Agreement",
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

    const result = await buildCaseDetailsTabUseCase(
      "64c88faac1f56f71e1b89a77",
      "case-details",
    );

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

    const result = await buildCaseDetailsTabUseCase(
      "test-case-id",
      "case-details",
    );

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
});
