import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";

import { Role } from "../models/role.js";
import { User } from "../models/user.js";
import { findAll } from "../repositories/role.repository.js";
import { findRolesUseCase } from "./find-roles.use-case.js";

vi.mock("../repositories/role.repository.js");

describe("findRolesUseCase", () => {
  it("throws 403 when user is not admin", async () => {
    const user = User.createMock();

    await expect(() => findRolesUseCase({ user })).rejects.toThrow(
      Boom.forbidden(
        `User ${user.id} does not have required roles to perform action`,
      ),
    );
  });

  it("returns all roles when user is admin", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    const roles = [Role.createMock(), Role.createMock()];
    findAll.mockResolvedValue(roles);

    const result = await findRolesUseCase({ user });

    expect(result).toEqual(roles);
    expect(findAll).toHaveBeenCalled();
  });

  it("returns roles sorted by code", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    const unsortedRoles = [
      Role.createMock({ code: "Z-Role" }),
      Role.createMock({ code: "A-Role" }),
      Role.createMock({ code: "M-Role" }),
    ];
    findAll.mockResolvedValue(unsortedRoles);

    const result = await findRolesUseCase({ user });

    expect(result.map((r) => r.code)).toEqual(["A-Role", "M-Role", "Z-Role"]);
    expect(findAll).toHaveBeenCalled();
  });
});
