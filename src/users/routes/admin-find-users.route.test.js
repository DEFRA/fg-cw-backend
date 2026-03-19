import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { User } from "../models/user.js";
import { adminFindUsersUseCase } from "../use-cases/admin-find-users.use-case.js";
import { adminFindUsersRoute } from "./admin-find-users.route.js";

vi.mock("../use-cases/admin-find-users.use-case.js");

describe("adminFindUsersRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(adminFindUsersRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns 403 when user is not admin", async () => {
    adminFindUsersUseCase.mockRejectedValue(Boom.forbidden("Forbidden"));

    const { statusCode } = await server.inject({
      method: "GET",
      url: "/admin/users",
      auth: {
        strategy: "entra",
        credentials: {
          user: User.createMock(),
        },
      },
    });

    expect(statusCode).toEqual(403);
  });

  it("returns users when user is admin", async () => {
    const users = [User.createMock(), User.createMock()];
    const admin = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });

    adminFindUsersUseCase.mockResolvedValue(users);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/admin/users",
      auth: {
        strategy: "entra",
        credentials: {
          user: admin,
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result.data).toEqual(users);
    expect(result.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
    expect(adminFindUsersUseCase).toHaveBeenCalledWith({
      user: admin,
      query: {
        ids: [],
        allAppRoles: [],
        anyAppRoles: [],
      },
    });
  });

  it("passes query parameters to adminFindUsersUseCase", async () => {
    const users = [User.createMock()];
    const admin = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });

    adminFindUsersUseCase.mockResolvedValue(users);

    const query = new URLSearchParams();
    query.append("ids", users[0].id);
    query.append("allAppRoles", "ROLE_ONE");
    query.append("anyAppRoles", "ROLE_ANY");

    const { statusCode } = await server.inject({
      method: "GET",
      url: `/admin/users?${query}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: admin,
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(adminFindUsersUseCase).toHaveBeenCalledWith({
      user: admin,
      query: {
        ids: [users[0].id],
        allAppRoles: ["ROLE_ONE"],
        anyAppRoles: ["ROLE_ANY"],
      },
    });
  });
});
