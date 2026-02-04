import { describe, expect, it, vi } from "vitest";
import { IdpRoles } from "../models/idp-roles.js";
import { Role } from "../models/role.js";
import { User } from "../models/user.js";
import { findByCode, update } from "../repositories/role.repository.js";
import { updateRoleUseCase } from "./update-role.use-case.js";

vi.mock("../repositories/role.repository.js");

describe("updateRoleUseCase", () => {
  it("updates a role when user is admin", async () => {
    const user = User.createMock({
      idpRoles: [IdpRoles.Admin],
    });

    const role = Role.createMock({
      code: "ROLE_TEST",
      description: "Old description",
      assignable: false,
    });

    findByCode.mockResolvedValue(role);

    const result = await updateRoleUseCase({
      user,
      code: role.code,
      description: "Updated description",
      assignable: true,
    });

    expect(result).toBeInstanceOf(Role);
    expect(result.description).toBe("Updated description");
    expect(result.assignable).toBe(true);
    expect(result.updatedAt).toBeDefined();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        code: role.code,
        description: "Updated description",
        assignable: true,
      }),
    );
  });

  it("throws forbidden when user is not admin", async () => {
    const user = User.createMock({
      idpRoles: [IdpRoles.ReadWrite],
    });

    await expect(
      updateRoleUseCase({
        user,
        code: "ROLE_TEST",
        description: "Updated description",
        assignable: true,
      }),
    ).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );

    expect(findByCode).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws not found when role does not exist", async () => {
    const user = User.createMock({
      idpRoles: [IdpRoles.Admin],
    });

    findByCode.mockResolvedValue(null);

    await expect(
      updateRoleUseCase({
        user,
        code: "ROLE_MISSING",
        description: "Updated description",
        assignable: false,
      }),
    ).rejects.toThrow("Role with code ROLE_MISSING not found");

    expect(update).not.toHaveBeenCalled();
  });
});
