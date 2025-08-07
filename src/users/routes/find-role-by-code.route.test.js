import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Role } from "../models/role.js";
import { findRoleResponseSchema } from "../schemas/responses/find-role-response.schema.js";
import { findRoleByCodeUseCase } from "../use-cases/find-role-by-code.use-case.js";
import { findRoleByCodeRoute } from "./find-role-by-code.route.js";

vi.mock("../use-cases/find-role-by-code.use-case.js");

describe("findRoleByCodeRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findRoleByCodeRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns a role by code", async () => {
    const role = Role.createMock();
    findRoleByCodeUseCase.mockResolvedValue(role);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/roles/${role.code}`,
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(role);

    expect(findRoleByCodeUseCase).toHaveBeenCalledWith(role.code);
  });

  it("validates response using findRoleResponseSchema", () => {
    expect(findRoleByCodeRoute.options.response.schema).toBe(
      findRoleResponseSchema,
    );
  });
});
