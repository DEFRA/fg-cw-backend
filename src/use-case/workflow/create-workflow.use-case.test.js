import { expect, describe, it, vi } from "vitest";
import { workflowRepository } from "../../repository/workflow.repository";
import { createWorkflowUseCase } from "./create-workflow.use-case";
import { WorkflowModel } from "../../models/workflow-model";

describe("Workflow Use Case: Create", () => {
  it("Should create a new workflow document and insert into repository", async () => {
    const workflow = {
      code: "0987-OIYT"
    };
    vi.spyOn(workflowRepository, "insert").mockResolvedValueOnce();
    await expect(createWorkflowUseCase(workflow)).resolves.toBe();
    expect(workflowRepository.insert).toHaveBeenCalledWith(
      expect.any(WorkflowModel)
    );
  });
});
