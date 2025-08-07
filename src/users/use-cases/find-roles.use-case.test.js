import { describe, expect, it, vi } from "vitest";
import { Role } from "../models/role.js";
import { findAll } from "../repositories/role.repository.js";
import { findRolesUseCase } from "./find-roles.use-case.js";

vi.mock("../repositories/role.repository.js");

describe("findRolesUseCase", () => {
  it("returns all roles", async () => {
    const roles = [Role.createMock(), Role.createMock()];

    findAll.mockResolvedValue(roles);

    const result = await findRolesUseCase();

    expect(result).toEqual(roles);
    expect(findAll).toHaveBeenCalled();
  });
});
