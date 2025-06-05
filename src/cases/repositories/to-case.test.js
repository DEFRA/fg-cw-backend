import { describe, expect, it } from "vitest";
import { Case } from "../models/case.js";
import { toCase } from "./to-case.js";

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
      stages: {},
    };
    const result = toCase(doc);
    expect(result).toBeInstanceOf(Case);
  });
});
