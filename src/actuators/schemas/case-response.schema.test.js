import { BSON } from "mongodb";
import { describe, expect, it } from "vitest";
import { caseDataResponseSchema } from "./case-response.schema.js";

const FACTS = {
  ref: { caseRef: "ref-1", workflowCode: "frps" },
  position: { phase: "P", stage: "S", status: "T" },
  closed: false,
  closedAt: null,
  createdAt: "2026-06-16T10:00:00.000Z",
};

const aMember = (overrides = {}) => ({
  caseRef: "ref-0",
  position: { phase: "P", stage: "S", status: "T" },
  createdAt: "2026-06-01T10:00:00.000Z",
  closedAt: null,
  ...overrides,
});

describe("caseDataResponseSchema", () => {
  const SUMMARY = {
    ...FACTS,
    originalConfigVersion: null,
    currentConfigVersion: "1.0.0",
    series: {
      latestRef: "ref-1",
      refs: ["ref-0", "ref-1"],
      members: [
        aMember(),
        aMember({ caseRef: "ref-1", closedAt: "2026-06-20T00:00:00.000Z" }),
      ],
    },
  };

  it("accepts the summary alone", () => {
    expect(
      caseDataResponseSchema.validate({ case: SUMMARY, storedBytes: 3600 })
        .error,
    ).toBeUndefined();
  });

  it.each([
    ["base64 of the document", BSON.serialize({ odd: 1 }).toString("base64")],
    ["null, for a document past the cap", null],
  ])("accepts as the document %s", (_, document) => {
    expect(
      caseDataResponseSchema.validate({
        case: { ...SUMMARY, series: null },
        storedBytes: 3600,
        document,
      }).error,
    ).toBeUndefined();
  });

  it.each([
    ["a decoded document", { payload: { x: 1 } }],
    ["text that isn't base64", "not base64!"],
  ])("refuses as the document %s", (_, document) => {
    expect(
      caseDataResponseSchema.validate({
        case: { ...SUMMARY, series: null },
        storedBytes: 3600,
        document,
      }).error,
    ).toBeDefined();
  });

  it("accepts a member with every fact null", () => {
    expect(
      caseDataResponseSchema.validate({
        case: {
          ...SUMMARY,
          series: {
            ...SUMMARY.series,
            members: [
              aMember({
                position: { phase: null, stage: null, status: null },
                createdAt: null,
              }),
            ],
          },
        },
        storedBytes: 3600,
      }).error,
    ).toBeUndefined();
  });

  it("requires the series' members", () => {
    const { members, ...series } = SUMMARY.series;

    expect(
      caseDataResponseSchema.validate({
        case: { ...SUMMARY, series },
        storedBytes: 3600,
      }).error,
    ).toBeDefined();
  });

  it("requires the stored size", () => {
    expect(
      caseDataResponseSchema.validate({ case: SUMMARY }).error,
    ).toBeDefined();
  });
});
