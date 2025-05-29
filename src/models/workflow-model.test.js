import { describe, it, expect } from "vitest";
import { WorkflowModel } from "./workflow-model";

describe("Workflow Model", () => {
  it("should create a new workflow model", () => {
    const data = {
      code: "0987-OPIY",
      payloadDefinition: {},
      stages: []
    };
    const newWorkflow = WorkflowModel.newWorkflow(data);
    expect(newWorkflow).toEqual(expect.any(WorkflowModel));
    expect(newWorkflow.code).toBe(data.code);
    expect(newWorkflow.payloadDefinition).toBe(data.payloadDefinition);
    expect(newWorkflow.stages).toBe(data.stages);
  });
});
