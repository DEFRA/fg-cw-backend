import { describe, expect, it, vi } from "vitest";
import { findCurrentSearches } from "../repositories/workflow.repository.js";
import { caseSearch } from "./case-search.js";
import { caseViewOf } from "./case-view.js";

vi.mock("../repositories/workflow.repository.js");

describe("caseSearch", () => {
  it("indexes cases by workflow code into case_search", () => {
    expect(caseSearch).toMatchObject({
      collection: "case_search",
      records: "cases",
      lead: "workflowCode",
      projection: { payload: 1, supplementaryData: 1 },
    });
  });

  it("reads each code's declaration from its current workflow version", async () => {
    findCurrentSearches.mockResolvedValue([
      { value: "workflow-a", search: null },
    ]);

    expect([...(await caseSearch.declarations.current()).keys()]).toEqual([
      "workflow-a",
    ]);
    expect(findCurrentSearches).toHaveBeenCalled();
  });
});

describe("caseViewOf", () => {
  it("is the payload and supplementary data, and nothing else of the case", () => {
    expect(
      caseViewOf({
        caseRef: "ref-1",
        workflowCode: "workflow-a",
        payload: { answers: { business: { name: "Hilltop" } } },
        supplementaryData: { agreements: [{ agreementRef: "AG-1" }] },
      }),
    ).toEqual({
      payload: { answers: { business: { name: "Hilltop" } } },
      supplementaryData: { agreements: [{ agreementRef: "AG-1" }] },
    });
  });

  it("is an empty view for a case with neither", () => {
    expect(caseViewOf({})).toEqual({ payload: {}, supplementaryData: {} });
  });
});
