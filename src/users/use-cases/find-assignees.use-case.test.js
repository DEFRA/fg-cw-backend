import { describe, expect, it, vi } from "vitest";

import { User } from "../models/user.js";
import { findAll } from "../repositories/user.repository.js";
import { findAssigneesUseCase } from "./find-assignees.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("findAssigneesUseCase", () => {
  it("returns id and name sorted", async () => {
    findAll.mockResolvedValue([
      User.createMock({ id: "5aaea69249c6d1beec839899", name: "Zara" }),
      User.createMock({ id: "543cd5d9a0812661c318fb24", name: "Alice" }),
    ]);

    const result = await findAssigneesUseCase({
      allAppRoles: ["ROLE_ONE"],
      anyAppRoles: ["ROLE_ANY"],
    });

    expect(findAll).toHaveBeenCalledWith({
      allAppRoles: ["ROLE_ONE"],
      anyAppRoles: ["ROLE_ANY"],
    });

    expect(result).toEqual([
      { id: "543cd5d9a0812661c318fb24", name: "Alice" },
      { id: "5aaea69249c6d1beec839899", name: "Zara" },
    ]);
  });
});
