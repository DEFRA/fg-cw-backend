import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Role } from "../models/role.js";
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
      auth: {
        strategy: "entra",
        credentials: {
          user: {
            id: "user-123",
            idpRoles: ["FCP.Casework.Admin", "FCP.Casework.Read"],
          },
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual({
      data: role,
      header: {
        navItems: [
          { title: "Admin", href: "/admin" },
          { title: "Casework", href: "/cases" },
        ],
      },
    });

    expect(findRoleByCodeUseCase).toHaveBeenCalledWith({
      user: {
        id: "user-123",
        idpRoles: ["FCP.Casework.Admin", "FCP.Casework.Read"],
      },
      code: role.code,
    });
  });
});
