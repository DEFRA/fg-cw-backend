import { describe, expect, it } from "vitest";
import { DOCUMENT_INCLUDE } from "../case/admin-case-query.js";
import { storedWorkflowPipeline } from "./admin-workflow-query.js";

describe("storedWorkflowPipeline", () => {
  const key = { code: "woodland", version: "1.2.0" };

  it("measures the whole document before projecting the summary", () => {
    expect(storedWorkflowPipeline(key)).toEqual([
      { $match: key },
      { $set: { storedBytes: { $bsonSize: "$$ROOT" } } },
      { $project: { storedBytes: 1, schemeName: 1, requiredRoles: 1 } },
    ]);
  });

  it("keeps the whole document for the document include", () => {
    expect(storedWorkflowPipeline(key, DOCUMENT_INCLUDE)).toEqual([
      { $match: key },
      { $set: { storedBytes: { $bsonSize: "$$ROOT" } } },
    ]);
  });
});
