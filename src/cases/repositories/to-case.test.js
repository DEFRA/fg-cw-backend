import { describe, it, expect } from "vitest";
import { toCase } from "./to-case.js";
import { Case } from "../../models/case.js";

describe("toCase", () => {
  it("should return a Case model", () => {
    const doc = {
      _id: "_id",
      caseRef: "caseRef",
      workflowCode: "workflowCode",
      status: "status",
      dateReceived: "dateReceived",
      priority: "priority",
      payload: {},
      currentStage: "currentStage",
      stages: {}
    };
    const result = toCase(doc);
    expect(result).toBeInstanceOf(Case);
  });
});
