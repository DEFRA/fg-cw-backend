import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { updateUserRequestSchema } from "../schemas/requests/update-user-request.schema.js";
import { updateUserUseCase } from "../use-cases/update-user.use-case.js";
import { updateUserRoute } from "./update-user.route.js";

vi.mock("../use-cases/update-user.use-case.js");

describe("updateUserRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(updateUserRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("updates a subset of user's details", async () => {
    const userId = "808b8c8f8c8f8c8f8c8f8c8f";

    const { statusCode, result } = await server.inject({
      method: "PATCH",
      url: `/users/${userId}`,
      payload: {
        name: "John",
        idpRoles: ["admin"],
        appRoles: ["ROLE_EDITOR"],
      },
    });

    expect(statusCode).toEqual(204);

    expect(result).toEqual(null);

    expect(updateUserUseCase).toHaveBeenCalledWith({
      userId,
      props: {
        name: "John",
        idpRoles: ["admin"],
        appRoles: ["ROLE_EDITOR"],
      },
    });
  });

  it("validates payload using updateUserRequestSchema", async () => {
    expect(updateUserRoute.options.validate.payload).toBe(
      updateUserRequestSchema,
    );
  });

  it("returns 400 when payload does not match schema", async () => {
    const userId = "808b8c8f8c8f8c8f8c8f8c8f";

    const { statusCode } = await server.inject({
      method: "PATCH",
      url: `/users/${userId}`,
      payload: {
        idpRoles: [1],
      },
    });

    expect(statusCode).toEqual(400);
  });
});
