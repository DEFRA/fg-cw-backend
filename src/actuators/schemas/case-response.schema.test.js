import { describe, expect, it } from "vitest";
import {
  caseDataResponseSchema,
  caseSearchResponseSchema,
} from "./case-response.schema.js";

const FACTS = {
  ref: { caseRef: "ref-1", workflowCode: "frps" },
  position: { phase: "P", stage: "S", status: "T" },
  closed: false,
  closedAt: null,
  createdAt: "2026-06-16T10:00:00.000Z",
};

const aRow = (overrides = {}) => ({ ...FACTS, replaced: false, ...overrides });

const aMember = (overrides = {}) => ({
  caseRef: "ref-0",
  position: { phase: "P", stage: "S", status: "T" },
  createdAt: "2026-06-01T10:00:00.000Z",
  closedAt: null,
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

  it("requires each row's replaced flag", () => {
    const { replaced, ...row } = aRow();

    expect(
      caseSearchResponseSchema.validate({
        cases: [row],
        pagination: { endCursor: null, hasNextPage: false },
      }).error,
    ).toBeDefined();
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

  it("accepts a document of any shape", () => {
    expect(
      caseDataResponseSchema.validate({
        case: { ...SUMMARY, series: null },
        storedBytes: 3600,
        document: { payload: { x: [1, { y: null }] }, odd: 1 },
      }).error,
    ).toBeUndefined();
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
