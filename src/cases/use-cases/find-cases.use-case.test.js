import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { Case } from "../models/case.js";
import { findAll } from "../repositories/case.repository.js";
import { findCasesUseCase } from "./find-cases.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../../users/use-cases/find-users.use-case.js");

describe("findCasesUseCase", () => {
  it("finds cases without assigned users", async () => {
    const casesWithoutUsers = [
      Case.createMock({ assignedUser: null }),
      Case.createMock({ assignedUser: null }),
    ];

    findAll.mockResolvedValue(casesWithoutUsers);
    findUsersUseCase.mockResolvedValue([]);

    const result = await findCasesUseCase();

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [] });
    expect(result).toEqual(casesWithoutUsers);
  });

  it("finds cases with assigned users and populates user", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const user2 = User.createMock({ id: "user-2", name: "Jane Jones" });
    const users = [user1, user2];

    const casesWithUsers = [
      Case.createMock({ assignedUser: { id: user1.id } }),
      Case.createMock({ assignedUser: { id: user2.id } }),
    ];

    findAll.mockResolvedValue(casesWithUsers);
    findUsersUseCase.mockResolvedValue(users);

    const result = await findCasesUseCase();

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, user2.id],
    });
    expect(result[0].assignedUser.name).toBe(user1.name);
    expect(result[1].assignedUser.name).toBe(user2.name);
  });

  it("finds cases with and without assigned users", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const user2 = User.createMock({ id: "user-2", name: "Jane Jones" });
    const users = [user1, user2];

    const mixedCases = [
      Case.createMock({ assignedUser: null }),
      Case.createMock({ assignedUser: { id: user1.id } }),
      Case.createMock({ assignedUser: null }),
      Case.createMock({ assignedUser: { id: user2.id } }),
    ];

    findAll.mockResolvedValue(mixedCases);
    findUsersUseCase.mockResolvedValue(users);

    const result = await findCasesUseCase();

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, user2.id],
    });
    expect(result[0].assignedUser).toBeNull();
    expect(result[1].assignedUser.name).toBe(user1.name);
    expect(result[2].assignedUser).toBeNull();
    expect(result[3].assignedUser.name).toBe(user2.name);
  });

  it("handles cases where assigned user is not found", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const users = [user1];

    const casesWithUsers = [
      Case.createMock({ assignedUser: { id: user1.id } }),
      Case.createMock({ assignedUser: { id: "user-missing" } }),
    ];

    findAll.mockResolvedValue(casesWithUsers);
    findUsersUseCase.mockResolvedValue(users);

    const result = await findCasesUseCase();

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [user1.id, "user-missing"],
    });
    expect(result[0].assignedUser.name).toBe(user1.name);
    expect(result[1].assignedUser.name).toBeUndefined();
  });

  it("throws when user lookup fails", async () => {
    const user1 = User.createMock({ id: "user-1", name: "John Smith" });
    const casesWithUsers = [
      Case.createMock({ assignedUser: { id: user1.id } }),
    ];
    const userError = new Error("Find users error");

    findAll.mockResolvedValue(casesWithUsers);
    findUsersUseCase.mockRejectedValue(userError);

    await expect(findCasesUseCase()).rejects.toThrow("Find users error");

    expect(findAll).toHaveBeenCalledWith();
    expect(findUsersUseCase).toHaveBeenCalledWith({ ids: [user1.id] });
  });
});
