import { describe, expect, it, vi } from "vitest";
import { IdpRoles } from "../models/idp-roles.js";
import { Role } from "../models/role.js";
import { User } from "../models/user.js";
import { findByCode } from "../repositories/role.repository.js";
import { findRoleByCodeUseCase } from "./find-role-by-code.use-case.js";

vi.mock("../repositories/role.repository.js");

describe("findRoleByCode", () => {
  it("finds a role by code when user is admin", async () => {
    const role = Role.createMock();
    const user = User.createMock({
      idpRoles: [IdpRoles.Admin],
    });

    findByCode.mockResolvedValue(role);

    const result = await findRoleByCodeUseCase({
      user,
      code: role.code,
    });

    expect(result).toEqual(role);
    expect(findByCode).toHaveBeenCalledWith(role.code);
  });

  it("throws forbidden when user is not admin", async () => {
    const user = User.createMock({
      idpRoles: [IdpRoles.ReadWrite],
    });

    await expect(
      findRoleByCodeUseCase({
        user,
        code: "ROLE_TEST",
      }),
    ).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );

    expect(findByCode).not.toHaveBeenCalled();
  });

  it("throws when roles not found", async () => {
    const nonExistentCode = "ROLE_NON_EXISTENT";
    const user = User.createMock({
      idpRoles: [IdpRoles.Admin],
    });

    findByCode.mockResolvedValue(null);

    await expect(
      findRoleByCodeUseCase({
        user,
        code: nonExistentCode,
      }),
    ).rejects.toThrow(`Role with code ${nonExistentCode} not found`);
  });
});
