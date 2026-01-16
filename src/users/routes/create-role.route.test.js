import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRoleRequestSchema } from "../schemas/requests/create-role-request.schema.js";
import { createRoleUseCase } from "../use-cases/create-role.use-case.js";
import { createRoleRoute } from "./create-role.route.js";

vi.mock("../use-cases/create-role.use-case.js");

describe("createRoleRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(createRoleRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("creates a new role and returns no content", async () => {
    createRoleUseCase.mockResolvedValue();

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/roles",
      auth: {
        strategy: "entra",
        credentials: {
          user: {
            id: "user-123",
          },
        },
      },
      payload: {
        code: "ROLE_RPA_CASES_APPROVE",
        description: "Test role description",
        assignable: true,
      },
    });

    expect(statusCode).toEqual(204);
    expect(result).toEqual(null);

    expect(createRoleUseCase).toHaveBeenCalledWith({
      user: {
        id: "user-123",
      },
      assignable: true,
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Test role description",
    });
  });

  it("validates payload using createRoleRequestSchema", () => {
    expect(createRoleRoute.options.validate.payload).toBe(
      createRoleRequestSchema,
    );
  });

  it("returns 400 when payload is invalid", async () => {
    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/roles",
      payload: {
        invalidField: "test",
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
