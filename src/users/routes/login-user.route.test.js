import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { loginUserUseCase } from "../use-cases/login-user.use-case.js";
import { loginUserRoute } from "./login-user.route.js";

vi.mock("../use-cases/login-user.use-case.js");

describe("loginUserRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(loginUserRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("creates or updates user and records login timestamp", async () => {
    const user = User.createMock({
      lastLoginAt: "2025-01-15T10:30:00.000Z",
    });

    loginUserUseCase.mockResolvedValue(user);

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/users/login",
      payload: {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Bob Bill",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["ReadWrite"],
      },
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(user);
    expect(loginUserUseCase).toHaveBeenCalledWith({
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["ReadWrite"],
    });
  });

  it("returns 200 when payload is valid", async () => {
    const user = User.createMock();
    loginUserUseCase.mockResolvedValue(user);

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/users/login",
      payload: {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Bob Bill",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["ReadWrite"],
      },
    });

    expect(statusCode).toEqual(200);
  });

  it("returns user with updated lastLoginAt field", async () => {
    const loginTime = "2025-01-15T10:30:00.000Z";
    const user = User.createMock({
      lastLoginAt: loginTime,
      updatedAt: loginTime,
    });

    loginUserUseCase.mockResolvedValue(user);

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/users/login",
      payload: {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Bob Bill",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["ReadWrite"],
      },
    });

    expect(statusCode).toEqual(200);
    expect(result.lastLoginAt).toBe(loginTime);
    expect(result.updatedAt).toBe(loginTime);
  });

  it("returns 400 when required fields are missing", async () => {
    const { statusCode } = await server.inject({
      method: "POST",
      url: "/users/login",
      payload: {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Bob Bill",
        // missing email and idpRoles
      },
    });

    expect(statusCode).toEqual(400);
  });

  it("accepts optional appRoles in payload", async () => {
    const user = User.createMock();
    loginUserUseCase.mockResolvedValue(user);

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/users/login",
      payload: {
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Bob Bill",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["ReadWrite"],
        appRoles: {
          ROLE_1: {
            name: "ROLE_1",
            startDate: "2025-01-01",
            endDate: "2100-01-01",
          },
        },
      },
    });

    expect(statusCode).toEqual(200);
  });
});
