import { describe, expect, it } from "vitest";
import { pagesSchema } from "./pages.schema.js";

describe("pagesSchema", () => {
  it("allows valid pages configuration", () => {
    const validPagesConfig = {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "string",
          },
          summary: {
            sbi: {
              label: "SBI",
              ref: "$.payload.identifiers.sbi",
              type: "string",
            },
            reference: {
              label: "Reference",
              ref: "$.caseRef",
              type: "string",
            },
            scheme: {
              label: "Scheme",
              ref: "$.payload.answers.scheme",
              type: "string",
            },
            createdAt: {
              label: "Created At",
              ref: "$.payload.createdAt",
              type: "date",
            },
          },
        },
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [
              {
                title: "Answers",
                type: "object",
                component: "list",
                fields: [
                  {
                    ref: "$.payload.answers.scheme",
                    type: "string",
                    label: "Scheme",
                  },
                  {
                    ref: "$.payload.answers.year",
                    type: "number",
                    label: "Year",
                  },
                  {
                    ref: "$.payload.answers.hasCheckedLandIsUpToDate",
                    type: "boolean",
                    label: "Has checked land is up to date?",
                  },
                ],
              },
              {
                title: "Selected actions for land parcels",
                type: "array",
                component: "table",
                fields: [
                  {
                    ref: "$.payload.answers.actionApplications[*].sheetId",
                    type: "string",
                    label: "Sheet Id",
                  },
                  {
                    ref: "$.payload.answers.actionApplications[*].parcelId",
                    type: "string",
                    label: "Parcel Id",
                  },
                  {
                    ref: "$.payload.answers.actionApplications[*].appliedFor",
                    type: "string",
                    label: "Applied For",
                    format: "{{quantity | fixed(4)}} {{unit}}",
                  },
                ],
              },
            ],
          },
        },
      },
    };

    expect(pagesSchema.validate(validPagesConfig).error).toBeUndefined();
  });

  it("allows flexible banner summary field names", () => {
    const pagesConfigWithCustomFields = {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "string",
          },
          summary: {
            customField1: {
              label: "Custom Field 1",
              ref: "$.payload.custom.field1",
              type: "string",
            },
            customField2: {
              label: "Custom Field 2",
              ref: "$.payload.custom.field2",
              type: "number",
            },
          },
        },
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [],
          },
        },
      },
    };

    expect(
      pagesSchema.validate(pagesConfigWithCustomFields).error,
    ).toBeUndefined();
  });

  it("does not allow missing banner", () => {
    const invalidConfig = {
      details: {
        // missing banner
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [],
          },
        },
      },
    };
    const { error } = pagesSchema.validate(invalidConfig);
    expect(error.name).toEqual("ValidationError");
  });

  it("does not allow missing tabs", () => {
    const invalidConfig = {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "string",
          },
          summary: {},
        },
        // missing tabs
      },
    };
    const { error } = pagesSchema.validate(invalidConfig);
    expect(error.name).toEqual("ValidationError");
  });

  it("does not allow invalid field types", () => {
    const invalidConfig = {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "invalid_type", // invalid type
          },
          summary: {},
        },
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [],
          },
        },
      },
    };
    const { error } = pagesSchema.validate(invalidConfig);
    expect(error.name).toEqual("ValidationError");
  });

  it("does not allow invalid section types", () => {
    const invalidConfig = {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "string",
          },
          summary: {},
        },
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [
              {
                title: "Answers",
                type: "invalid_type", // invalid type
                component: "list",
                fields: [],
              },
            ],
          },
        },
      },
    };
    const { error } = pagesSchema.validate(invalidConfig);
    expect(error.name).toEqual("ValidationError");
  });

  it("does not allow invalid component types", () => {
    const invalidConfig = {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "string",
          },
          summary: {},
        },
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [
              {
                title: "Answers",
                type: "object",
                component: "invalid_component", // invalid component
                fields: [],
              },
            ],
          },
        },
      },
    };
    const { error } = pagesSchema.validate(invalidConfig);
    expect(error.name).toEqual("ValidationError");
  });

  it("does not allow missing required field properties", () => {
    const invalidConfig = {
      details: {
        banner: {
          title: {
            ref: "$.payload.businessName",
            type: "string",
          },
          summary: {},
        },
        tabs: {
          caseDetails: {
            title: "Application",
            sections: [
              {
                title: "Answers",
                type: "object",
                component: "list",
                fields: [
                  {
                    ref: "$.payload.answers.scheme",
                    // missing type and label
                  },
                ],
              },
            ],
          },
        },
      },
    };
    const { error } = pagesSchema.validate(invalidConfig);
    expect(error.name).toEqual("ValidationError");
  });
});
