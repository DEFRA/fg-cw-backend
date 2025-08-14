import { describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "../../common/auth.js";
import { Case } from "../models/case.js";
import { Comment } from "../models/comment.js";
import { findById, update } from "../repositories/case.repository.js";
import { addNoteToCaseUseCase } from "./add-note-to-case.use-case.js";

vi.mock("../../common/auth.js");
vi.mock("../repositories/case.repository.js");

describe("addNoteToCaseUseCase", () => {
  it("adds note to case successfully", async () => {
    const mockCase = Case.createMock();
    const authenticatedUser = { id: "user-123" };
    const command = {
      caseId: mockCase._id,
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(getAuthenticatedUser).toHaveBeenCalled();

    expect(result).toBeInstanceOf(Comment);
    expect(result.type).toBe("NOTE_ADDED");
    expect(result.text).toBe("This is a test note");
    expect(result.createdBy).toBe("user-123");
    expect(result.ref).toBeDefined();
    expect(result.createdAt).toBeDefined();

    expect(update).toHaveBeenCalledWith(mockCase);
    expect(mockCase.comments).toContain(result);
  });

  it("adds note with different type", async () => {
    const mockCase = Case.createMock();
    const authenticatedUser = { id: "user-456" };
    const command = {
      caseId: mockCase._id,
      type: "TASK_COMPLETED",
      text: "Task has been completed",
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(result.type).toBe("TASK_COMPLETED");
    expect(result.text).toBe("Task has been completed");
    expect(result.createdBy).toBe("user-456");
  });

  it("throws error when case is not found", async () => {
    const command = {
      caseId: "non-existent-case-id",
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    findById.mockResolvedValue(null);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      'Case with id "non-existent-case-id" not found',
    );

    expect(findById).toHaveBeenCalledWith("non-existent-case-id");
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when comment creation fails", async () => {
    const mockCase = Case.createMock();
    const authenticatedUser = { id: "user-123" };
    const command = {
      caseId: mockCase._id,
      type: "", // Invalid type - empty string
      text: "This is a test note",
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Invalid Comment",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(getAuthenticatedUser).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when comment text is missing", async () => {
    const mockCase = Case.createMock();
    const authenticatedUser = { id: "user-123" };
    const command = {
      caseId: mockCase._id,
      type: "NOTE_ADDED",
      text: "", // Invalid text - empty string
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Invalid Comment",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(getAuthenticatedUser).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when addComment fails", async () => {
    const mockCase = {
      ...Case.createMock(),
      addComment: vi.fn().mockImplementation(() => {
        throw new Error("Failed to add comment");
      }),
    };
    const authenticatedUser = { id: "user-123" };
    const command = {
      caseId: mockCase._id,
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Failed to add comment",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(getAuthenticatedUser).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when repository update fails", async () => {
    const mockCase = Case.createMock();
    const authenticatedUser = { id: "user-123" };
    const command = {
      caseId: mockCase._id,
      type: "NOTE_ADDED",
      text: "This is a test note",
    };

    const updateError = new Error("Database update failed");
    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
    update.mockRejectedValue(updateError);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Database update failed",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(getAuthenticatedUser).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(mockCase);
  });

  it("preserves existing comments when adding new note", async () => {
    const existingComment = new Comment({
      type: "NOTE_ADDED",
      text: "Existing comment",
      createdBy: "user-999",
    });

    const mockCase = Case.createMock({
      comments: [existingComment],
    });

    const authenticatedUser = { id: "user-123" };
    const command = {
      caseId: mockCase._id,
      type: "NOTE_ADDED",
      text: "New comment",
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(mockCase.comments).toHaveLength(2);
    expect(mockCase.comments).toContain(existingComment);
    expect(mockCase.comments).toContain(result);
    expect(update).toHaveBeenCalledWith(mockCase);
  });
});
