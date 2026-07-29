import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { logoutUserUseCase } from "../use-cases/logout-user.use-case.js";
import { logoutUserRoute } from "./logout-user.route.js";

vi.mock("../use-cases/logout-user.use-case.js");

describe("logoutUserRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(logoutUserRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("records the logout and returns 204", async () => {
    logoutUserUseCase.mockResolvedValue(User.createMock());

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/users/logout",
      payload: { userId: "507f1f77bcf86cd799439011" },
    });

    expect(statusCode).toEqual(204);
    expect(logoutUserUseCase).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
    });
  });

  it("returns 400 when userId is missing", async () => {
    const { statusCode } = await server.inject({
      method: "POST",
      url: "/users/logout",
      payload: {},
    });

    expect(statusCode).toEqual(400);
  });

  it("returns 400 when userId is not a valid object id", async () => {
    const { statusCode } = await server.inject({
      method: "POST",
      url: "/users/logout",
      payload: { userId: "not-an-object-id" },
    });

    expect(statusCode).toEqual(400);
  });
});
