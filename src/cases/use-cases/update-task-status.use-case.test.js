import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import {
  updateTaskStatusUseCase,
  validatePayloadComment,
} from "./update-task-status.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-case-by-id.use-case.js");
vi.mock("../repositories/workflow.repository.js");

describe("updateTaskStatusUseCase", () => {
  const authenticatedUserId = new ObjectId().toHexString();
  const mockAuthUser = {
    id: authenticatedUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
    appRoles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("throws if comment payload is not provided but required", () => {
    expect(() => validatePayloadComment(undefined, true)).toThrowError();
  });

  it("does not throw if comment payload is provided", () => {
    expect(() => validatePayloadComment("Hello", true)).not.toThrowError();
  });

  it("does not throw if comment payload is not provided and not required", () => {
    expect(() => validatePayloadComment(undefined, false)).not.toThrowError();
  });

  it("throws if case not found", async () => {
    const workflow = Workflow.createMock();
    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(null);

    await expect(() =>
      updateTaskStatusUseCase({
        caseId: "0909990909099990aaee9878",
        stageCode: "stage-1",
        taskGroupCode: "stage-1-tasks",
        taskId: "task-1",
        status: "complete",
        comment: "This is a note/comment",
        user: mockAuthUser,
      }),
    ).rejects.toThrow('Case with id "0909990909099990aaee9878" not found');
  });

  it("updates the status of a task", async () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.workflowCode = workflow.code;

    findByCode.mockResolvedValue(workflow);
    findById.mockResolvedValue(kase);

    await updateTaskStatusUseCase({
      caseId: kase._id,
      stageCode: "stage-1",
      taskGroupCode: "stage-1-tasks",
      taskId: "task-1",
      status: "complete",
      comment: "This is a note/comment",
      user: mockAuthUser,
    });

    const task = kase.findTask("task-1");
    expect(task.status).toBe("complete");
    expect(task.commentRef).toBeDefined();
    expect(update).toHaveBeenCalledWith(kase);
  });
});
