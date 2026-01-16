import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";

import { User } from "../models/user.js";
import { findAll } from "../repositories/user.repository.js";
import { adminFindUsersUseCase } from "./admin-find-users.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("adminFindUsersUseCase", () => {
  it("throws 403 when user is not admin", async () => {
    const user = User.createMock();

    await expect(() => adminFindUsersUseCase({ user })).rejects.toThrow(
      Boom.forbidden(
        `User ${user.id} does not have required roles to perform action`,
      ),
    );
  });

  it("returns users when user is admin", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    const users = [User.createMock(), User.createMock()];
    findAll.mockResolvedValue(users);

    const result = await adminFindUsersUseCase({ user, query: { ids: [] } });

    expect(result).toEqual(users);
    expect(findAll).toHaveBeenCalledWith({ ids: [] });
  });
});
