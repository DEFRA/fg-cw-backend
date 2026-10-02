import { describe, expect, it } from "vitest";
import {
  caseDataResponseSchema,
  caseSearchResponseSchema,
} from "./case-response.schema.js";

const aRow = (overrides = {}) => ({
  ref: { caseRef: "ref-1", workflowCode: "frps" },
  position: { phase: "P", stage: "S", status: "T" },
  closed: false,
  closedAt: null,
  createdAt: "2026-06-16T10:00:00.000Z",
  ...overrides,
});

describe("caseSearchResponseSchema", () => {
  it("accepts a first page with its total and codes", () => {
    expect(
      caseSearchResponseSchema.validate({
        cases: [aRow()],
        pagination: { endCursor: "c", hasNextPage: true },
        total: { count: 10_000, capped: true },
        workflowCodes: ["frps"],
      }).error,
    ).toBeUndefined();
  });

  it("accepts a row from a legacy document with every fact null", () => {
    expect(
      caseSearchResponseSchema.validate({
        cases: [
          aRow({
            ref: { caseRef: null, workflowCode: null },
            position: { phase: null, stage: null, status: null },
            closed: null,
            createdAt: null,
          }),
        ],
        pagination: { endCursor: null, hasNextPage: false },
      }).error,
    ).toBeUndefined();
  });

  it("refuses a row carrying the payload", () => {
    expect(
      caseSearchResponseSchema.validate({
        cases: [aRow({ payload: {} })],
        pagination: { endCursor: null, hasNextPage: false },
      }).error,
    ).toBeDefined();
  });
});

describe("caseDataResponseSchema", () => {
  const SUMMARY = {
    ...aRow(),
    originalConfigVersion: null,
    currentConfigVersion: "1.0.0",
    series: { latestRef: "ref-1", refs: ["ref-0", "ref-1"] },
  };

  it("accepts the summary alone", () => {
    expect(
      caseDataResponseSchema.validate({ case: SUMMARY, storedBytes: 3600 })
        .error,
    ).toBeUndefined();
  });

  it("accepts a document of any shape", () => {
    expect(
      caseDataResponseSchema.validate({
        case: { ...SUMMARY, series: null },
        storedBytes: 3600,
        document: { payload: { x: [1, { y: null }] }, odd: 1 },
      }).error,
    ).toBeUndefined();
  });

  it("requires the stored size", () => {
    expect(
      caseDataResponseSchema.validate({ case: SUMMARY }).error,
    ).toBeDefined();
  });
});
