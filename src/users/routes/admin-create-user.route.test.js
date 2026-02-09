import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { User } from "../models/user.js";
import { adminCreateUserUseCase } from "../use-cases/admin-create-user.use-case.js";
import { adminCreateUserRoute } from "./admin-create-user.route.js";

vi.mock("../use-cases/admin-create-user.use-case.js");

describe("adminCreateUserRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(adminCreateUserRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns 403 when user is not admin", async () => {
    adminCreateUserUseCase.mockRejectedValue(Boom.forbidden("Forbidden"));

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/admin/users",
      payload: {
        name: "Test User",
        email: "test@example.com",
      },
      auth: {
        strategy: "entra",
        credentials: {
          user: User.createMock(),
        },
      },
    });

    expect(statusCode).toEqual(403);
  });

  it("returns 409 when email already exists", async () => {
    adminCreateUserUseCase.mockRejectedValue(
      Boom.conflict("A user with this email address already exists"),
    );

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/admin/users",
      payload: {
        name: "Test User",
        email: "existing@example.com",
      },
      auth: {
        strategy: "entra",
        credentials: {
          user: User.createMock({ idpRoles: ["FCP.Casework.Admin"] }),
        },
      },
    });

    expect(statusCode).toEqual(409);
  });

  it("returns created user when successful", async () => {
    const admin = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });

    const createdUser = User.createMock({
      name: "New User",
      email: "new@example.com",
      createdManually: true,
    });

    adminCreateUserUseCase.mockResolvedValue(createdUser);

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/admin/users",
      payload: {
        name: "New User",
        email: "new@example.com",
      },
      auth: {
        strategy: "entra",
        credentials: {
          user: admin,
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result.data).toEqual(createdUser);
    expect(result.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
    expect(adminCreateUserUseCase).toHaveBeenCalledWith({
      user: admin,
      props: {
        name: "New User",
        email: "new@example.com",
      },
    });
  });

  it("returns 400 when name is missing", async () => {
    const { statusCode } = await server.inject({
      method: "POST",
      url: "/admin/users",
      payload: {
        email: "test@example.com",
      },
      auth: {
        strategy: "entra",
        credentials: {
          user: User.createMock({ idpRoles: ["FCP.Casework.Admin"] }),
        },
      },
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 400 when email is invalid", async () => {
    const { statusCode } = await server.inject({
      method: "POST",
      url: "/admin/users",
      payload: {
        name: "Test User",
        email: "invalid-email",
      },
      auth: {
        strategy: "entra",
        credentials: {
          user: User.createMock({ idpRoles: ["FCP.Casework.Admin"] }),
        },
      },
    });

    expect(statusCode).toEqual(400);
  });
});
