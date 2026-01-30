import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { appRoles } from "../../../test/helpers/appRoles.js";
import { User } from "../models/user.js";
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
    const user = User.createMock();

    updateUserUseCase.mockResolvedValue(user);

    const { statusCode, result } = await server.inject({
      method: "PATCH",
      url: `/admin/users/${user.id}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: {
            id: user.id,
            idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
          },
        },
      },
      payload: {
        name: "John",
        idpRoles: ["admin"],
        appRoles: {
          ROLE_RPA_CASES_APPROVE: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
      },
    });

    expect(statusCode).toEqual(200);

    expect(result.data).toEqual(user);
    expect(result.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });

    expect(updateUserUseCase).toHaveBeenCalledWith({
      authenticatedUser: {
        id: user.id,
        idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
      },
      userId: user.id,
      props: {
        name: "John",
        idpRoles: ["admin"],
        appRoles,
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
      url: `/admin/users/${userId}`,
      payload: {
        idpRoles: [1],
      },
    });

    expect(statusCode).toEqual(400);
  });
});
