import { describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { findById } from "../repositories/user.repository.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("findUserByIdUseCase", () => {
  it("finds user by id", async () => {
    const user = User.createMock({
      id: "test-case-id",
    });

    findById.mockResolvedValue(user);

    const result = await findUserByIdUseCase("test-case-id");

    expect(findById).toHaveBeenCalledWith("test-case-id");

    expect(result).toStrictEqual(user);
  });

  it("throws when case not found", async () => {
    findById.mockResolvedValue(null);

    await expect(findUserByIdUseCase("non-existent-case-id")).rejects.toThrow(
      'User with id "non-existent-case-id" not found',
    );
  });
});
