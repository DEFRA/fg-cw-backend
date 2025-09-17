import { describe, expect, it } from "vitest";
import {
  buildBanner,
  buildLinks,
  createRootContext,
  shouldRender,
} from "./build-view-model.js";

describe("shouldRender", () => {
  const mockRoot = {
    showSection: true,
    hideSection: false,
    agreements: [{ id: 1 }],
    emptyArray: [],
    nullValue: null,
  };

  it("should return true when no renderIf condition", () => {
    const item = { content: "always show" };
    const result = shouldRender(mockRoot, item);
    expect(result).toBe(true);
  });

  it("should return true when renderIf resolves to truthy value", () => {
    const item = { renderIf: "$.showSection", content: "conditionally shown" };
    const result = shouldRender(mockRoot, item);
    expect(result).toBe(true);
  });

  it("should return false when renderIf resolves to falsy value", () => {
    const item = { renderIf: "$.hideSection", content: "conditionally hidden" };
    const result = shouldRender(mockRoot, item);
    expect(result).toBe(false);
  });

  it("should return true when renderIf resolves to non-empty array", () => {
    const item = {
      renderIf: "$.agreements[0]",
      content: "show if has agreements",
    };
    const result = shouldRender(mockRoot, item);
    expect(result).toBe(true);
  });

  it("should return false when renderIf resolves to empty string", () => {
    const item = { renderIf: "$.emptyArray[0]", content: "show if has items" };
    const result = shouldRender(mockRoot, item);
    expect(result).toBe(false);
  });

  it("should return false when renderIf resolves to null", () => {
    const item = { renderIf: "$.nullValue", content: "show if not null" };
    const result = shouldRender(mockRoot, item);
    expect(result).toBe(false);
  });

  it("should handle undefined item", () => {
    const result = shouldRender(mockRoot, undefined);
    expect(result).toBe(true);
  });

  it("should handle null item", () => {
    const result = shouldRender(mockRoot, null);
    expect(result).toBe(true);
  });
});

describe("createRootContext", () => {
  it("should merge case and workflow definitions", () => {
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
            "case-details": {
              link: {
                id: "case-details",
                href: {
                  urlTemplate: "/cases/{caseId}/details",
                  params: { caseId: "$._id" },
                },
                text: "Case Details",
                index: 1,
              },
            },
            agreements: {
              renderIf: "$.agreements[0]",
              link: {
                id: "agreements",
                href: "/cases/case-123/agreements",
                text: "Agreements",
              },
            },
            "no-link-tab": {
              content: ["some content"],
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
      { id: "tasks", href: "/cases/case-123", text: "Tasks" },
      {
        id: "case-details",
        href: "/cases/case-123/details",
        text: "Case Details",
        index: 1,
      },
      { id: "notes", href: "/cases/case-123/notes", text: "Notes" },
      { id: "timeline", href: "/cases/case-123/timeline", text: "Timeline" },
    ]);
  });

  it("should skip tabs that should not render", () => {
    const caseWithoutAgreements = { ...mockCase, agreements: [] };
    const result = buildLinks(caseWithoutAgreements, mockWorkflow);

    expect(result.find((link) => link.id === "agreements")).toBeUndefined();
  });

  it("should skip tabs without links", () => {
    const result = buildLinks(mockCase, mockWorkflow);

    expect(result.find((link) => link.id === "no-link-tab")).toBeUndefined();
  });

  it("should handle workflow without tab definitions", () => {
    const workflowWithoutTabs = {
      code: "minimal-workflow",
      pages: {
        cases: {
          details: {
            tabs: {},
          },
        },
      },
      definitions: {},
    };

    const result = buildLinks(mockCase, workflowWithoutTabs);

    expect(result).toEqual([
      { id: "tasks", href: "/cases/case-123", text: "Tasks" },
      { id: "notes", href: "/cases/case-123/notes", text: "Notes" },
      { id: "timeline", href: "/cases/case-123/timeline", text: "Timeline" },
    ]);
  });

  it("should append links without index to end", () => {
    const workflowWithAppendLink = {
      ...mockWorkflow,
      pages: {
        cases: {
          details: {
            tabs: {
              "append-tab": {
                link: {
                  id: "append-tab",
                  href: "/cases/case-123/append",
                  text: "Appended Tab",
                },
              },
            },
          },
        },
      },
    };

    const result = buildLinks(mockCase, workflowWithAppendLink);

    expect(result[result.length - 1]).toEqual({
      id: "append-tab",
      href: "/cases/case-123/append",
      text: "Appended Tab",
    });
  });

  it("should handle case with agreements that should render", () => {
    const caseWithAgreements = {
      ...mockCase,
      agreements: [{ id: "agreement-1" }],
    };

    const result = buildLinks(caseWithAgreements, mockWorkflow);

    expect(result.find((link) => link.id === "agreements")).toEqual({
      id: "agreements",
      href: "/cases/case-123/agreements",
      text: "Agreements",
    });
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

    expect(result.summary.nested.deep.value).toEqual({
      label: "Deep Value",
      text: "SBI001",
      type: "string",
    });
    expect(result.metadata.definitions).toBe("https://api.example.com");
  });
});
