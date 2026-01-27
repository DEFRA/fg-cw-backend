import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { User } from "../models/user.js";
import { adminAccessCheckUseCase } from "../use-cases/admin-access-check.use-case.js";
import { adminAccessCheckRoute } from "./admin-access-check.route.js";

vi.mock("../use-cases/admin-access-check.use-case.js");

describe("adminAccessCheckRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(adminAccessCheckRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns 403 when user is not admin", async () => {
    adminAccessCheckUseCase.mockImplementation(() => {
      throw Boom.forbidden("Forbidden");
    });

    const { statusCode } = await server.inject({
      method: "GET",
      url: "/admin/access-check",
      auth: {
        strategy: "entra",
        credentials: {
          user: User.createMock(),
        },
      },
    });

    expect(statusCode).toEqual(403);
  });

  it("returns 200 when user is admin", async () => {
    const admin = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    adminAccessCheckUseCase.mockReturnValue({ ok: true });

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/admin/access-check",
      auth: {
        strategy: "entra",
        credentials: {
          user: admin,
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual({ ok: true });
    expect(adminAccessCheckUseCase).toHaveBeenCalledWith({
      user: admin,
    });
  });
});
