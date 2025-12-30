import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { Case } from "../models/case.js";
import { Comment } from "../models/comment.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { addNoteToCaseUseCase } from "./add-note-to-case.use-case.js";

vi.mock("../../common/auth.js");
vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");

describe("addNoteToCaseUseCase", () => {
  const validUserId = new ObjectId().toHexString();

  const requiredRoles = {
    allOf: ["ROLE_1", "ROLE_2"],
    anyOf: ["ROLE_3"],
  };

  const mockUser = User.createMock({
    id: validUserId,
    idpRoles: [IdpRoles.ReadWrite],
  });

  it("adds note to case successfully", async () => {
    const mockCase = Case.createMock();

    const command = {
      caseId: mockCase._id,
      text: "This is a test note",
      user: mockUser,
    };

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue({ requiredRoles });
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(findById).toHaveBeenCalledWith(mockCase._id);

    expect(result).toBeInstanceOf(Comment);
    expect(result.type).toBe("NOTE_ADDED");
    expect(result.text).toBe("This is a test note");
    expect(result.createdBy).toBe(mockUser.id);
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
    findByCode.mockResolvedValue({ requiredRoles });
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(result.type).toBe("NOTE_ADDED");
    expect(result.text).toBe("Task has been completed");
    expect(result.createdBy).toBe(mockUser.id);
  });

  it("throws forbidden when user does not have ReadWrite role", async () => {
    const mockCase = Case.createMock();

    const user = User.createMock({
      id: new ObjectId().toHexString(),
      idpRoles: [IdpRoles.Read],
    });

    const command = {
      caseId: mockCase._id,
      text: "This is a test note",
      user,
    };

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue({ requiredRoles });

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );

    expect(update).not.toHaveBeenCalled();
  });

  it("throws forbidden when user does not have required workflow roles", async () => {
    const mockCase = Case.createMock();

    const user = User.createMock({
      id: new ObjectId().toHexString(),
      idpRoles: [IdpRoles.ReadWrite],
      appRoles: {},
    });

    const command = {
      caseId: mockCase._id,
      text: "This is a test note",
      user,
    };

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue({ requiredRoles });

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );

    expect(update).not.toHaveBeenCalled();
  });

  it("throws error when workflow is not found", async () => {
    const mockCase = Case.createMock();

    const command = {
      caseId: mockCase._id,
      text: "This is a test note",
      user: mockUser,
    };

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue(null);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      `Workflow not found: ${mockCase.workflowCode}`,
    );

    expect(findByCode).toHaveBeenCalledWith(mockCase.workflowCode);
    expect(update).not.toHaveBeenCalled();
  });

  it("defaults to no required roles when appRoles is missing", async () => {
    const mockCase = Case.createMock();

    const command = {
      caseId: mockCase._id,
      text: "This is a test note",
      user: mockUser,
    };

    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue({});
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(findByCode).toHaveBeenCalledWith(mockCase.workflowCode);
    expect(result).toBeInstanceOf(Comment);
    expect(result.text).toBe("This is a test note");
    expect(update).toHaveBeenCalledWith(mockCase);
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
    findByCode.mockResolvedValue({ requiredRoles });

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Failed to add note",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
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
    findByCode.mockResolvedValue({ requiredRoles });

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Note text is required and cannot be empty",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
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
    findByCode.mockResolvedValue({ requiredRoles });
    update.mockRejectedValue(updateError);

    await expect(addNoteToCaseUseCase(command)).rejects.toThrow(
      "Database update failed",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
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
    findByCode.mockResolvedValue({ requiredRoles });
    update.mockResolvedValue(mockCase);

    const result = await addNoteToCaseUseCase(command);

    expect(mockCase.comments).toHaveLength(2);
    expect(mockCase.comments[1].ref).toEqual(existingComment.ref);
    expect(mockCase.comments).toContain(result);
    expect(update).toHaveBeenCalledWith(mockCase);
  });
});
