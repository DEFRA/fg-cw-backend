import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Role } from "../models/role.js";
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

  it("returns all roles", async () => {
    const roles = [Role.createMock(), Role.createMock()];

    findRolesUseCase.mockResolvedValue(roles);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/roles",
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(roles);

    expect(findRolesUseCase).toHaveBeenCalled();
  });

  it("validates response using findRolesResponseSchema", () => {
    expect(findRolesRoute.options.response.schema).toBe(
      findRolesResponseSchema,
    );
  });
});
