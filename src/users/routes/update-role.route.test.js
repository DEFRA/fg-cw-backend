import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { updateRoleRequestSchema } from "../schemas/requests/update-role-request.schema.js";
import { updateRoleUseCase } from "../use-cases/update-role.use-case.js";
import { updateRoleRoute } from "./update-role.route.js";

vi.mock("../use-cases/update-role.use-case.js");

describe("updateRoleRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(updateRoleRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("updates a role and returns no content", async () => {
    updateRoleUseCase.mockResolvedValue();

    const { statusCode, result } = await server.inject({
      method: "PUT",
      url: "/roles/ROLE_RPA_CASES_APPROVE",
      auth: {
        strategy: "entra",
        credentials: {
          user: {
            id: "user-123",
          },
        },
      },
      payload: {
        description: "Updated description",
        assignable: false,
      },
    });

    expect(statusCode).toEqual(204);
    expect(result).toEqual(null);

    expect(updateRoleUseCase).toHaveBeenCalledWith({
      user: {
        id: "user-123",
      },
      code: "ROLE_RPA_CASES_APPROVE",
      description: "Updated description",
      assignable: false,
    });
  });

  it("validates payload using updateRoleRequestSchema", async () => {
    expect(updateRoleRoute.options.validate.payload).toBe(
      updateRoleRequestSchema,
    );
  });

  it("returns 400 when payload is invalid", async () => {
    const { statusCode, result } = await server.inject({
      method: "PUT",
      url: "/roles/ROLE_RPA_CASES_APPROVE",
      payload: {
        description: "Updated description",
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
