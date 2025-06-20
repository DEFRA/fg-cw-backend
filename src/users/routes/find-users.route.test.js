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
});
