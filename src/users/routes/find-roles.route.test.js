import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Role } from "../models/role.js";
import { User } from "../models/user.js";
import { findRolesResponseSchema } from "../schemas/responses/find-roles-response.schema.js";
import { findRolesUseCase } from "../use-cases/find-roles.use-case.js";
import { findRolesRoute } from "./find-roles.route.js";

vi.mock("../use-cases/find-roles.use-case.js");

describe("findRolesRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findRolesRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns 403 when user is not admin", async () => {
    findRolesUseCase.mockRejectedValue(Boom.forbidden("Forbidden"));

    const { statusCode } = await server.inject({
      method: "GET",
      url: "/roles",
      auth: {
        strategy: "entra",
        credentials: {
          user: User.createMock(),
        },
      },
    });

    expect(statusCode).toEqual(403);
  });

  it("returns all roles when user is admin", async () => {
    const roles = [Role.createMock(), Role.createMock()];
    const admin = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    findRolesUseCase.mockResolvedValue(roles);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/roles",
      auth: {
        strategy: "entra",
        credentials: {
          user: admin,
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(roles);
    expect(findRolesUseCase).toHaveBeenCalledWith({
      user: admin,
    });
  });

  it("validates response using findRolesResponseSchema", () => {
    expect(findRolesRoute.options.response.schema).toBe(
      findRolesResponseSchema,
    );
  });
});
