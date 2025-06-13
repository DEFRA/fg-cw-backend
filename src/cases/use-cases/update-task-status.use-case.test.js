import { describe, expect, it, vi } from "vitest";
import { updateTaskStatus } from "../repositories/case.repository.js";
import { updateTaskStatusUseCase } from "./update-task-status.use-case.js";

vi.mock("../repositories/case.repository.js");

describe("updateTaskStatusUseCase", () => {
  it("updates the status of a task", async () => {
    await updateTaskStatusUseCase({
      caseId: "case-123",
      stageId: "stage-456",
      taskGroupId: "task-group-789",
      taskId: "task-101112",
      status: "complete",
    });

    expect(updateTaskStatus).toHaveBeenCalledWith({
      caseId: "case-123",
      stageId: "stage-456",
      taskGroupId: "task-group-789",
      taskId: "task-101112",
      status: "complete",
    });
  });
});
