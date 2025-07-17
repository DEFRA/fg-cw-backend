import { describe, expect, it, vi } from "vitest";
import { updateTaskStatus } from "../repositories/case.repository.js";
import { updateTaskStatusUseCase } from "./update-task-status.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-case-by-id.use-case.js");

describe("updateTaskStatusUseCase", () => {
  it("updates the status of a task", async () => {
    const { findUserAssignedToCase } = await import(
      "./find-case-by-id.use-case.js"
    );
    vi.mocked(findUserAssignedToCase).mockResolvedValue("Test User");

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
      timelineEvent: expect.objectContaining({
        eventType: "TASK_COMPLETED",
        createdBy: "Test User",
        description: "Task completed",
        data: {
          caseId: "case-123",
          stageId: "stage-456",
          taskGroupId: "task-group-789",
          taskId: "task-101112",
        },
      }),
    });
  });
});
