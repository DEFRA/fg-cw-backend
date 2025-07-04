import { describe, expect, it, vi } from "vitest";
import { Role } from "../models/role.js";
import { findByCode } from "../repositories/role.repository.js";
import { findRoleByCodeUseCase } from "./find-role-by-code.use-case.js";

vi.mock("../repositories/role.repository.js");

describe("findRoleByCode", () => {
  it("finds a role by code", async () => {
    const role = Role.createMock();

    findByCode.mockResolvedValue(role);

    const result = await findRoleByCodeUseCase(role.code);

    expect(result).toEqual(role);
    expect(findByCode).toHaveBeenCalledWith(role.code);
  });

  it("throws when roles not found", async () => {
    const nonExistentCode = "NonExistent.Code";

    await expect(findRoleByCodeUseCase(nonExistentCode)).rejects.toThrow(
      `Role with code "${nonExistentCode}" not found`,
    );
  });
});
