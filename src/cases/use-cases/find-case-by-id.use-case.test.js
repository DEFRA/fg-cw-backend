import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { Case } from "../models/case.js";
import { findById } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../../users/use-cases/find-user-by-id.use-case.js");

describe("findCaseByIdUseCase", () => {
  it("finds case by id", async () => {
    const kase = new Case({ _id: "test-case-id" });

    findById.mockResolvedValue(kase);

    const result = await findCaseByIdUseCase("test-case-id");

    expect(findById).toHaveBeenCalledWith("test-case-id");

    expect(result).toBe(kase);
  });

  it("throws when case not found", async () => {
    findById.mockResolvedValue(null);

    await expect(findCaseByIdUseCase("non-existent-case-id")).rejects.toThrow(
      'Case with id "non-existent-case-id" not found',
    );
  });

  it("finds case with assigned user and populates user name", async () => {
    const mockUser = User.createMock();
    const mockCase = Case.createMock({
      assignedUser: { id: mockUser.id },
    });

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockResolvedValue(mockUser);

    const result = await findCaseByIdUseCase(mockCase._id);

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockUser.id);
    expect(result.assignedUser.name).toBe(mockUser.name);
    expect(result).toBe(mockCase);
  });

  it("throws when user lookup fails for assigned user", async () => {
    const mockCase = new Case({
      assignedUser: { id: "unknown-user-id" },
    });
    const userError = new Error("User not found");

    findById.mockResolvedValue(mockCase);
    findUserByIdUseCase.mockRejectedValue(userError);

    await expect(findCaseByIdUseCase(mockCase._id)).rejects.toThrow(
      "User not found",
    );

    expect(findById).toHaveBeenCalledWith(mockCase._id);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(mockCase.assignedUser.id);
  });
});
