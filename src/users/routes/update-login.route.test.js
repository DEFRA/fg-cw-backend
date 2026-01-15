import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { updateLoginUseCase } from "../use-cases/update-login.use-case.js";
import { updateLoginRoute } from "./update-login.route.js";

vi.mock("../use-cases/update-login.use-case.js");

describe("updateLoginRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(updateLoginRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("updates login timestamp for existing user", async () => {
    const user = User.createMock({
      lastLoginAt: "2025-01-15T10:30:00.000Z",
    });

    updateLoginUseCase.mockResolvedValue(user);

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/users/696946c3d3476aeda1d0706a/login",
      payload: {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      },
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(user);
    expect(updateLoginUseCase).toHaveBeenCalledWith({
      userId: "696946c3d3476aeda1d0706a",
    });
  });

  it("returns 200 when user exists", async () => {
    const user = User.createMock();
    updateLoginUseCase.mockResolvedValue(user);

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/users/507f1f77bcf86cd799439011/login",
    });

    expect(statusCode).toEqual(200);
  });

  it("returns 204 when user not found", async () => {
    updateLoginUseCase.mockResolvedValue(null);

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/users/507f1f77bcf86cd799439022/login",
    });

    expect(statusCode).toEqual(204);
  });

  it("returns user with updated lastLoginAt field", async () => {
    const loginTime = "2025-01-15T10:30:00.000Z";
    const user = User.createMock({
      lastLoginAt: loginTime,
      updatedAt: loginTime,
    });

    updateLoginUseCase.mockResolvedValue(user);

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/users/696946c3d3476aeda1d0706a/login",
      payload: {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      },
    });

    expect(statusCode).toEqual(200);
    expect(result.lastLoginAt).toBe(loginTime);
    expect(result.updatedAt).toBe(loginTime);
  });
});
