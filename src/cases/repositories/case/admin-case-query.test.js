import { describe, expect, it, vi } from "vitest";
import {
  CASE_ROW_PROJECTION,
  CASE_SUMMARY_PROJECTION,
  DOCUMENT_INCLUDE,
  seriesFilter,
  seriesMembersCursor,
  storedCasePipeline,
} from "./admin-case-query.js";

describe("seriesFilter", () => {
  it("finds the series containing the ref, under a workflow when given", () => {
    expect(seriesFilter({ ref: "ref-2" })).toEqual({ caseRefs: "ref-2" });
    expect(seriesFilter({ ref: "ref-2", workflowCode: "frps" })).toEqual({
      caseRefs: "ref-2",
      workflowCode: "frps",
    });
  });
});

describe("seriesMembersCursor", () => {
  it("reads the members' rows under the workflow on the unique key", () => {
    const find = vi.fn().mockReturnValue("the-cursor");

    expect(
      seriesMembersCursor(
        { find },
        { workflowCode: "frps", caseRefs: ["r1", "r2"] },
        { maxTimeMS: 3000 },
      ),
    ).toBe("the-cursor");
    expect(find).toHaveBeenCalledWith(
      { workflowCode: "frps", caseRef: { $in: ["r1", "r2"] } },
      {
        projection: CASE_ROW_PROJECTION,
        hint: { workflowCode: 1, caseRef: 1 },
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
    expect(storedCasePipeline(key, DOCUMENT_INCLUDE)).toEqual([
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
    [
      "the summary pipeline",
      storedCasePipeline({ workflowCode: "w", caseRef: "r" }),
    ],
    [
      "the document pipeline",
      storedCasePipeline({ workflowCode: "w", caseRef: "r" }, DOCUMENT_INCLUDE),
    ],
  ])("%s names no payload or supplementary data", (_name, query) => {
    expect(JSON.stringify(query)).not.toMatch(/payload|supplementaryData/);
  });
});
