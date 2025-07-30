import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { createUserRequestSchema } from "../schemas/requests/create-user-request.schema.js";
import { createUserUseCase } from "../use-cases/create-user.use-case.js";
import { createUserRoute } from "./create-user.route.js";

vi.mock("../use-cases/create-user.use-case.js");

describe("createUserRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(createUserRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("creates a new user and returns it", async () => {
    const user = User.createMock();

    createUserUseCase.mockResolvedValue(user);

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/users",
      payload: {
        idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
        name: "John",
        email: "john.doe@defra.co.uk",
        idpRoles: ["defra-idp"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "01/07/2025",
            endDate: "02/08/2025",
          },
        },
      },
    });

    expect(statusCode).toEqual(201);

    expect(result).toEqual(user);

    expect(createUserUseCase).toHaveBeenCalledWith({
      idpId: "abcd1234-5678-90ab-cdef-1234567890ab",
      name: "John",
      email: "john.doe@defra.co.uk",
      idpRoles: ["defra-idp"],
      appRoles: {
        ROLE_RPA_CASES_APPROVE: {
          startDate: new Date("2025-07-01T00:00:00.000Z"),
          endDate: new Date("2025-08-02T00:00:00.000Z"),
        },
      },
    });
  });

  it("validates payload using createGrantRequestSchema", async () => {
    expect(createUserRoute.options.validate.payload).toBe(
      createUserRequestSchema,
    );
  });

  it("returns 400 when payload is invalid", async () => {
    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/users",
      payload: {
        code: "test",
      },
    });

    expect(statusCode).toEqual(400);
    expect(result).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid request payload input",
    });
  });
});
