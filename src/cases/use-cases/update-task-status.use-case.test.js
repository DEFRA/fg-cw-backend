import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { updateTaskStatusUseCase } from "./update-task-status.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-case-by-id.use-case.js");
vi.mock("../repositories/workflow.repository.js");

describe("updateTaskStatusUseCase", () => {
  it("updates the status of a task", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      stageId: "stage-1",
      taskGroupId: "stage-1-tasks",
      taskId: "task-1",
      status: "complete",
      comment: "This is a note/comment",
    });

    const task = kase.stages[0].taskGroups[0].tasks[0];
    expect(task.status).toBe("complete");
    expect(task.commentRef).toBeDefined();
    expect(update).toHaveBeenCalledWith(kase);
  });
});
