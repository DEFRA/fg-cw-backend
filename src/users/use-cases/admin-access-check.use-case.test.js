import Boom from "@hapi/boom";
import { describe, expect, it } from "vitest";

import { User } from "../models/user.js";
import { adminAccessCheckUseCase } from "./admin-access-check.use-case.js";

describe("adminAccessCheckUseCase", () => {
  it("throws 403 when user is not admin", () => {
    const user = User.createMock();

    expect(() => adminAccessCheckUseCase({ user })).toThrow(
      Boom.forbidden(
        `User ${user.id} does not have required roles to perform action`,
      ),
    );
  });

  it("returns ok when user is admin", () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    const result = adminAccessCheckUseCase({ user });

    expect(result).toEqual({ ok: true });
  });
});
