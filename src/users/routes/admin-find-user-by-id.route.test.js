import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { User } from "../models/user.js";
import { adminFindUserByIdUseCase } from "../use-cases/admin-find-user-by-id.use-case.js";
import { adminFindUserByIdRoute } from "./admin-find-user-by-id.route.js";

vi.mock("../use-cases/admin-find-user-by-id.use-case.js");

describe("adminFindUserByIdRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(adminFindUserByIdRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns 403 when user is not admin", async () => {
    adminFindUserByIdUseCase.mockRejectedValue(Boom.forbidden("Forbidden"));

    const { statusCode } = await server.inject({
      method: "GET",
      url: `/admin/users/${User.createMock().id}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: User.createMock(),
        },
      },
    });

    expect(statusCode).toEqual(403);
  });

  it("returns a user matching userId when user is admin", async () => {
    const userId = User.createMock().id;
    const admin = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });
    const user = User.createMock({
      id: userId,
    });

    adminFindUserByIdUseCase.mockResolvedValueOnce(user);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/admin/users/${userId}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: admin,
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(user);
    expect(adminFindUserByIdUseCase).toHaveBeenCalledWith({
      user: admin,
      userId,
    });
  });
});
