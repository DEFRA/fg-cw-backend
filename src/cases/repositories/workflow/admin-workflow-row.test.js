import { describe, expect, it } from "vitest";
import { toWorkflowSummary } from "./admin-workflow-row.js";

describe("toWorkflowSummary", () => {
  it("carries the scheme name and required roles", () => {
    expect(
      toWorkflowSummary({
        schemeName: "Woodland creation",
        requiredRoles: { allOf: ["ROLE_A"], anyOf: ["ROLE_B"] },
      }),
    ).toEqual({
      schemeName: "Woodland creation",
      requiredRoles: { allOf: ["ROLE_A"], anyOf: ["ROLE_B"] },
    });
  });

  it("gives a workflow stored without a scheme name a null one", () => {
    expect(
      toWorkflowSummary({ requiredRoles: { allOf: [], anyOf: [] } }),
    ).toEqual({
      schemeName: null,
      requiredRoles: { allOf: [], anyOf: [] },
    });
  });
});
