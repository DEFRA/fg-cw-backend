import { describe, expect, it } from "vitest";
import { toPositionNames, toWorkflowSummary } from "./admin-workflow-row.js";

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

describe("toPositionNames", () => {
  const version = {
    phases: [
      {
        code: "PRE_AWARD",
        name: "Pre-award",
        stages: [
          {
            code: "REVIEW",
            name: "Review",
            statuses: [
              { code: "NEW", name: "New" },
              { code: "HELD", name: "On hold" },
            ],
          },
        ],
      },
      { code: "AWARD", name: "Award", stages: [] },
    ],
  };

  it("names every phase, and the position's stage and status", () => {
    expect(
      toPositionNames(version, {
        phase: "PRE_AWARD",
        stage: "REVIEW",
        status: "HELD",
      }),
    ).toEqual({
      phases: [
        { code: "PRE_AWARD", name: "Pre-award" },
        { code: "AWARD", name: "Award" },
      ],
      stage: "Review",
      status: "On hold",
    });
  });

  it("names a stage or status the version does not have null", () => {
    expect(
      toPositionNames(version, {
        phase: "AWARD",
        stage: "REVIEW",
        status: "NEW",
      }),
    ).toMatchObject({ stage: null, status: null });
    expect(
      toPositionNames(version, {
        phase: "PRE_AWARD",
        stage: "REVIEW",
        status: "GONE",
      }),
    ).toMatchObject({ stage: "Review", status: null });
  });

  it("reads an odd document as nulls rather than failing", () => {
    expect(
      toPositionNames(
        { phases: [{ code: "P", name: { en: "P" }, stages: "x" }, null] },
        { phase: "P", stage: null, status: null },
      ),
    ).toEqual({
      phases: [
        { code: "P", name: null },
        { code: null, name: null },
      ],
      stage: null,
      status: null,
    });
    expect(toPositionNames({}, { phase: null })).toEqual({
      phases: [],
      stage: null,
      status: null,
    });
  });
});
