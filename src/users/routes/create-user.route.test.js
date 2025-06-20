import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

  it("creates a new workflow and returns no content", async () => {
    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/users",
      payload: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@defra.co.uk",
        roles: {
          idp: ["defra-idp"],
          app: ["cw-app"],
        },
      },
    });

    expect(statusCode).toEqual(204);

    expect(result).toEqual(null);

    expect(createUserUseCase).toHaveBeenCalledWith({
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@defra.co.uk",
      roles: {
        idp: ["defra-idp"],
        app: ["cw-app"],
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
