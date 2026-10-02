import { describe, expect, it, vi } from "vitest";
import {
  CASE_ROW_PROJECTION,
  CASE_SUMMARY_PROJECTION,
  browseFilter,
  caseListBySeriesCursor,
  caseListPageOptions,
  seriesFilter,
  seriesSearchFilter,
  storedCasePipeline,
} from "./admin-case-query.js";

const FROM = "2026-06-01T00:00:00.000Z";
const TO = "2026-06-30T23:59:59.999Z";

describe("browseFilter", () => {
  it("is every case with no query", () => {
    expect(browseFilter({})).toEqual({});
  });

  it("bounds createdAt as Dates, inclusive, and filters by workflow", () => {
    expect(browseFilter({ workflowCode: "frps", from: FROM, to: TO })).toEqual({
      workflowCode: "frps",
      createdAt: { $gte: new Date(FROM), $lte: new Date(TO) },
    });
  });

  it("takes either bound alone", () => {
    expect(browseFilter({ to: TO })).toEqual({
      createdAt: { $lte: new Date(TO) },
    });
  });
});

describe("seriesSearchFilter", () => {
  it("matches each series' members under its own workflow, and the bare ref", () => {
    expect(
      seriesSearchFilter({
        ref: "ref-2",
        series: [
          { workflowCode: "frps", caseRefs: ["ref-1", "ref-2"] },
          { workflowCode: "woodland", caseRefs: ["ref-2"] },
        ],
      }),
    ).toEqual({
      $or: [
        { workflowCode: "frps", caseRef: { $in: ["ref-1", "ref-2"] } },
        { workflowCode: "woodland", caseRef: { $in: ["ref-2"] } },
        { caseRef: "ref-2" },
      ],
    });
  });

  it("adds the workflow and range filters to the whole match", () => {
    expect(
      seriesSearchFilter({
        ref: "ref-2",
        series: [],
        workflowCode: "frps",
        from: FROM,
      }),
    ).toEqual({
      $or: [{ caseRef: "ref-2" }],
      workflowCode: "frps",
      createdAt: { $gte: new Date(FROM) },
    });
  });
});

describe("seriesFilter", () => {
  it("finds the series containing the ref, under a workflow when given", () => {
    expect(seriesFilter({ ref: "ref-2" })).toEqual({ caseRefs: "ref-2" });
    expect(seriesFilter({ ref: "ref-2", workflowCode: "frps" })).toEqual({
      caseRefs: "ref-2",
      workflowCode: "frps",
    });
  });
});

describe("caseListPageOptions", () => {
  it("pages the browse newest first, 20 at a time, with no total", () => {
    expect(
      caseListPageOptions({ workflowCode: "frps", cursor: "c" }),
    ).toMatchObject({
      filter: { workflowCode: "frps" },
      cursor: "c",
      sort: { createdAt: -1, _id: -1 },
      pageSize: 20,
      withTotal: false,
      project: CASE_ROW_PROJECTION,
    });
  });

  it("decodes a cursor's createdAt as a Date", () => {
    const { codecs } = caseListPageOptions({});

    expect(codecs.createdAt.decode("2026-06-16T10:00:00.000Z")).toEqual(
      new Date("2026-06-16T10:00:00.000Z"),
    );
  });
});

describe("caseListBySeriesCursor", () => {
  it("reads the match unsorted, bounded, on the caseRef index", () => {
    const find = vi.fn().mockReturnValue("the-cursor");

    expect(
      caseListBySeriesCursor(
        { find },
        { ref: "r", series: [] },
        { limit: 201, maxTimeMS: 3000 },
      ),
    ).toBe("the-cursor");
    expect(find).toHaveBeenCalledWith(
      { $or: [{ caseRef: "r" }] },
      {
        projection: CASE_ROW_PROJECTION,
        limit: 201,
        hint: { caseRef: 1 },
        maxTimeMS: 3000,
      },
    );
  });
});

describe("storedCasePipeline", () => {
  const key = { workflowCode: "frps", caseRef: "ref-2" };

  it("measures the whole document before projecting the summary", () => {
    expect(storedCasePipeline(key)).toEqual([
      { $match: key },
      { $set: { storedBytes: { $bsonSize: "$$ROOT" } } },
      { $project: { ...CASE_SUMMARY_PROJECTION, storedBytes: 1 } },
    ]);
  });

  it("removes only the caseworker notes for the document", () => {
    expect(storedCasePipeline(key, "document")).toEqual([
      { $match: key },
      { $set: { storedBytes: { $bsonSize: "$$ROOT" } } },
      { $unset: "comments" },
    ]);
  });
});

// The payload and supplementary data are the workflow's: no query names a
// path inside them.
describe("opacity", () => {
  it.each([
    ["the row projection", CASE_ROW_PROJECTION],
    ["the summary projection", CASE_SUMMARY_PROJECTION],
    ["the browse filter", browseFilter({ workflowCode: "w", from: FROM })],
    [
      "the series search",
      seriesSearchFilter({
        ref: "r",
        series: [{ workflowCode: "w", caseRefs: ["r"] }],
      }),
    ],
    [
      "the summary pipeline",
      storedCasePipeline({ workflowCode: "w", caseRef: "r" }),
    ],
    [
      "the document pipeline",
      storedCasePipeline({ workflowCode: "w", caseRef: "r" }, "document"),
    ],
  ])("%s names no payload or supplementary data", (_name, query) => {
    expect(JSON.stringify(query)).not.toMatch(/payload|supplementaryData/);
  });
});
