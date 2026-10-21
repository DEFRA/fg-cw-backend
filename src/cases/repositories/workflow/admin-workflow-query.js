import { DOCUMENT_INCLUDE } from "../case/admin-case-query.js";

// The admin read model's query over `workflows`. Without the document, only
// what the version's overview shows.
const WORKFLOW_SUMMARY_PROJECTION = {
  storedBytes: 1,
  schemeName: 1,
  requiredRoles: 1,
};

// `storedBytes` measures the whole stored document.
export const storedWorkflowPipeline = ({ code, version }, include) => [
  { $match: { code, version } },
  { $set: { storedBytes: { $bsonSize: "$$ROOT" } } },
  ...(include === DOCUMENT_INCLUDE
    ? []
    : [{ $project: WORKFLOW_SUMMARY_PROJECTION }]),
];
