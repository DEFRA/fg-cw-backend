import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";

import { User } from "../models/user.js";
import { adminFindUserByIdUseCase } from "./admin-find-user-by-id.use-case.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

vi.mock("./find-user-by-id.use-case.js");

describe("adminFindUserByIdUseCase", () => {
  it("throws 403 when user is not admin", async () => {
    const user = User.createMock();

    await expect(() =>
      adminFindUserByIdUseCase({ user, userId: user.id }),
    ).rejects.toThrow(
      Boom.forbidden(
        `User ${user.id} does not have required roles to perform action`,
      ),
    );
  });

  it("returns user when user is admin", async () => {
    const admin = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });
    const userId = User.createMock().id;
    const user = User.createMock({ id: userId });

    findUserByIdUseCase.mockResolvedValueOnce(user);

    const result = await adminFindUserByIdUseCase({ user: admin, userId });

    expect(result).toEqual(user);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(userId);
  });
});
