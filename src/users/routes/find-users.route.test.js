import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { findUsersUseCase } from "../use-cases/find-users.use-case.js";
import { findUsersRoute } from "./find-users.route.js";

vi.mock("../use-cases/find-users.use-case.js");

describe("findUsersRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findUsersRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns users", async () => {
    const users = [User.createMock(), User.createMock()];

    findUsersUseCase.mockResolvedValue(users);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/users",
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(users);
  });

  it("returns users by all app roles and any app roles", async () => {
    const users = [User.createMock(), User.createMock()];

    findUsersUseCase.mockResolvedValue(users);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/users?allAppRoles=ROLE_RPA_ADMIN&allAppRoles=ROLE_RPA_SUPER_ADMIN&anyAppRoles=ROLE_ANY_OF",
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(users);
    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: [],
      allAppRoles: ["ROLE_RPA_ADMIN", "ROLE_RPA_SUPER_ADMIN"],
      anyAppRoles: ["ROLE_ANY_OF"],
    });
  });

  it("returns users by idpId", async () => {
    const users = [User.createMock(), User.createMock()];

    findUsersUseCase.mockResolvedValue(users);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/users?idpId=a6b2c9f4-40c4-4f6d-9e7a-3cd37f4cb45e",
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(users);
    expect(findUsersUseCase).toHaveBeenCalledWith({
      idpId: "a6b2c9f4-40c4-4f6d-9e7a-3cd37f4cb45e",
      ids: [],
      allAppRoles: [],
      anyAppRoles: [],
    });
  });

  it("returns users by ids", async () => {
    const users = [User.createMock(), User.createMock()];

    findUsersUseCase.mockResolvedValue(users);

    const query = new URLSearchParams();
    query.append("ids", users[0].id);
    query.append("ids", users[1].id);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/users?${query}`,
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(users);

    expect(findUsersUseCase).toHaveBeenCalledWith({
      ids: users.map((user) => user.id),
      allAppRoles: [],
      anyAppRoles: [],
    });
  });
});
