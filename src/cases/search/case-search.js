import { defineSearchSource } from "../../common/search/source.js";
import { findCurrentSearches } from "../repositories/workflow.repository.js";
import { caseViewOf } from "./case-view.js";

export const CASE_SEARCH = "case_search";

export const caseSearch = defineSearchSource({
  collection: CASE_SEARCH,
  records: "cases",
  lead: "workflowCode",
  projection: { payload: 1, supplementaryData: 1 },
  viewOf: caseViewOf,
  listDeclarations: findCurrentSearches,
});
