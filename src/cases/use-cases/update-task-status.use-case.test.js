import { describe, expect, it, vi } from "vitest";
import { update } from "../repositories/case.repository.js";
import { findUserAssignedToCase } from "./find-case-by-id.use-case.js";
import { updateTaskStatusUseCase } from "./update-task-status.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-case-by-id.use-case.js");

describe("updateTaskStatusUseCase", () => {
  it("updates the status of a task", async () => {
    findUserAssignedToCase.mockReturnValue("Test User");

    const caseId = "2245aaa84cb6481bb3325791";
    await updateTaskStatusUseCase({
      caseId,
      stageId: "stage-456",
      taskGroupId: "task-group-789",
      taskId: "task-101112",
      status: "complete",
    });

    expect(update).toHaveBeenCalledWith({});
  });
});
