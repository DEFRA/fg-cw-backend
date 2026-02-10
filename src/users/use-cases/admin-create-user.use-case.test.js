import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";

import { User } from "../models/user.js";
import { findByEmail, save } from "../repositories/user.repository.js";
import { adminCreateUserUseCase } from "./admin-create-user.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("adminCreateUserUseCase", () => {
  it("throws 403 when user is not admin", async () => {
    const user = User.createMock();

    await expect(() =>
      adminCreateUserUseCase({
        user,
        props: { name: "Test User", email: "test@example.com" },
      }),
    ).rejects.toThrow(
      Boom.forbidden(
        `User ${user.id} does not have required roles to perform action`,
      ),
    );
  });

  it("throws 409 when email already exists", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    findByEmail.mockResolvedValue(User.createMock());

    await expect(() =>
      adminCreateUserUseCase({
        user,
        props: { name: "Test User", email: "existing@example.com" },
      }),
    ).rejects.toThrow(
      Boom.conflict("A user with this email address already exists"),
    );

    expect(findByEmail).toHaveBeenCalledWith("existing@example.com");
  });

  it("creates user when user is admin and email is unique", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    findByEmail.mockResolvedValue(null);
    save.mockResolvedValue();

    const result = await adminCreateUserUseCase({
      user,
      props: { name: "New User", email: "new@example.com" },
    });

    expect(findByEmail).toHaveBeenCalledWith("new@example.com");
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New User",
        email: "new@example.com",
        createdManually: true,
        idpRoles: [],
        appRoles: {},
      }),
    );

    expect(result.name).toBe("New User");
    expect(result.email).toBe("new@example.com");
    expect(result.createdManually).toBe(true);
    expect(result.idpId).toBeDefined();
    expect(result.id).toBeDefined();
  });
});
