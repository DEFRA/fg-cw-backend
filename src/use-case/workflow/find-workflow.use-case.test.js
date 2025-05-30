import { describe, expect, it, vi } from "vitest";
import { findWorkflowUseCase } from "./find-workflow.use-case";
import { workflowRepository } from "../../repository/workflow.repository";
import { WorkflowModel } from "../../models/workflow-model";

describe("Workflow Use Case: Find", () => {
  it("Should return undefined if no workflow found with code", async () => {
    vi.spyOn(workflowRepository, "findOne").mockResolvedValueOnce();
    const code = "0987-ABCD";
    await expect(findWorkflowUseCase(code)).rejects.toThrow(
      `Workflow with code ${code} not found`
    );
    expect(workflowRepository.findOne).toHaveBeenCalledWith(code);
  });

  it("Should return a workflow definition", async () => {
    const expectedWorkflow = {
      _id: "00000000999",
      code: "0987-ABCD"
    };
    vi.spyOn(workflowRepository, "findOne").mockResolvedValueOnce(
      expectedWorkflow
    );
    const code = "0987-ABCD";
    const workflow = await findWorkflowUseCase(code);
    expect(workflowRepository.findOne).toHaveBeenCalledWith(code);
    expect(workflow).toEqual(expect.any(WorkflowModel));
    expect(workflow.code).toEqual("0987-ABCD");
    expect(workflow._id).toBe("00000000999");
  });
});
