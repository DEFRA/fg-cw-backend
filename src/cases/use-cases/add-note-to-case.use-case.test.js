import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { getAuthenticatedUser } from "../../common/auth.js";
import { Case } from "../models/case.js";
import { Comment } from "../models/comment.js";
import { findById, update } from "../repositories/case.repository.js";
import { addNoteToCaseUseCase } from "./add-note-to-case.use-case.js";

vi.mock("../../common/auth.js");
vi.mock("../repositories/case.repository.js");

describe("addNoteToCaseUseCase", () => {
  const validUserId = new ObjectId().toHexString();
  const authenticatedUser = { id: validUserId };
  const mockUser = {
    id: validUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
    appRoles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it("adds note to case successfully", async () => {
    const mockCase = Case.createMock();

    const command = {
      caseId: mockCase._id,
      text: "This is a test note",
      user: mockUser,
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
    expect(result.createdBy).toBe(authenticatedUser.id);
    expect(result.ref).toBeDefined();
    expect(result.createdAt).toBeDefined();

    expect(update).toHaveBeenCalledWith(mockCase);
    expect(mockCase.comments).toContain(result);
  });

  it("creates note with NOTE_ADDED type", async () => {
    const mockCase = Case.createMock();

    const command = {
      caseId: mockCase._id,
      text: "Task has been completed",
      user: mockUser,
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(result.type).toBe("NOTE_ADDED");
    expect(result.text).toBe("Task has been completed");
    expect(result.createdBy).toBe(authenticatedUser.id);
  });

  it("throws error when case is not found", async () => {
    const command = {
      caseId: "non-existent-case-id",
      text: "This is a test note",
      user: mockUser,
    };

    findById.mockResolvedValue(null);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      'Case with id "non-existent-case-id" not found',
    );

    expect(findById).toHaveBeenCalledWith("non-existent-case-id");
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when addNote fails", async () => {
    const mockCase = {
      ...Case.createMock(),
      addNote: vi.fn().mockImplementation(() => {
        throw new Error("Failed to add note");
      }),
    };

    const command = {
      caseId: mockCase._id,
      text: "This is a test note",
      user: mockUser,
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Failed to add note",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(getAuthenticatedUser).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when comment text is missing", async () => {
    const mockCase = Case.createMock();

    const command = {
      caseId: mockCase._id,
      text: "", // Invalid text - empty string
      user: mockUser,
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Note text is required and cannot be empty",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(getAuthenticatedUser).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when repository update fails", async () => {
    const mockCase = Case.createMock();

    const command = {
      caseId: mockCase._id,
      text: "This is a test note",
      user: mockUser,
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
    const existingComment = {
      ref: new ObjectId().toHexString(),
      type: "NOTE_ADDED",
      text: "Existing comment",
      createdBy: "user-999",
    };

    const mockCase = Case.createMock({
      comments: [existingComment],
    });

    const command = {
      caseId: mockCase._id,
      text: "New comment",
      user: mockUser,
    };

    findById.mockResolvedValue(mockCase);
    getAuthenticatedUser.mockReturnValue(authenticatedUser);
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(mockCase.comments).toHaveLength(2);
    expect(mockCase.comments[1].ref).toEqual(existingComment.ref);
    expect(mockCase.comments).toContain(result);
    expect(update).toHaveBeenCalledWith(mockCase);
  });
});
