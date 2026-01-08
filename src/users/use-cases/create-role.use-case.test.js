import { describe, expect, it, vi } from "vitest";
import { IdpRoles } from "../models/idp-roles.js";
import { Role } from "../models/role.js";
import { User } from "../models/user.js";
import { save } from "../repositories/role.repository.js";
import { createRoleUseCase } from "./create-role.use-case.js";

vi.mock("../repositories/role.repository.js");

describe("createRoleUseCase", () => {
  it("creates a role when user is admin", async () => {
    const props = {
      code: "TEST.ROLE",
      description: "Test role description",
    };

    const user = User.createMock({
      idpRoles: [IdpRoles.Admin],
    });

    const result = await createRoleUseCase({
      user,
      ...props,
    });

    expect(result).toBeInstanceOf(Role);
    expect(result.code).toBe(props.code);
    expect(result.description).toBe(props.description);
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it("throws forbidden when user is not admin", async () => {
    const props = {
      code: "TEST.ROLE",
      description: "Test role description",
    };

    const user = User.createMock({
      id: "user-123",
      idpRoles: [IdpRoles.ReadWrite],
    });

    await expect(
      createRoleUseCase({
        user,
        ...props,
      }),
    ).rejects.toThrow(
      `User ${user.id} does not have required roles to perform action`,
    );

    expect(save).not.toHaveBeenCalled();
  });
});
