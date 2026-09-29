import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  PUBLIC_API_STRATEGY,
  SERVICE_TOKEN_SCHEME,
} from "../../server/plugins/auth/public-api.js";
import { findUserRolesUseCase } from "../use-cases/find-user-roles.use-case.js";
import { findUserRolesRoute } from "./find-user-roles.route.js";

vi.mock("../use-cases/find-user-roles.use-case.js");

const entraId = "6a232710-1c66-4f8b-967d-41d41ae38478";

const credentials = { service: "gas", tokenId: "token-id" };

const inject = (url) =>
  server.inject({
    method: "GET",
    url,
    auth: { strategy: PUBLIC_API_STRATEGY, credentials },
  });

let server;

describe("findUserRolesRoute", () => {
  beforeAll(async () => {
    server = hapi.server();
    server.auth.scheme(SERVICE_TOKEN_SCHEME, () => ({
      authenticate: (request, h) => h.authenticated({ credentials }),
    }));
    server.auth.strategy(PUBLIC_API_STRATEGY, SERVICE_TOKEN_SCHEME);
    server.route(findUserRolesRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns the user's active roles", async () => {
    const appRoles = [{ roleName: "ROLE_WMP_CLAIMS", from: null, to: null }];
    findUserRolesUseCase.mockResolvedValue({ appRoles });

    const { statusCode, result } = await inject(`/api/users/${entraId}/roles`);

    expect(statusCode).toEqual(200);
    expect(result).toEqual({ appRoles });
    expect(findUserRolesUseCase).toHaveBeenCalledWith({ entraId });
  });

  it("returns an empty list when the user has no active roles", async () => {
    findUserRolesUseCase.mockResolvedValue({ appRoles: [] });

    const { statusCode, result } = await inject(`/api/users/${entraId}/roles`);

    expect(statusCode).toEqual(200);
    expect(result).toEqual({ appRoles: [] });
  });

  it("rejects an entraId that is not a uuid", async () => {
    const { statusCode } = await inject("/api/users/not-a-uuid/roles");

    expect(statusCode).toEqual(400);
  });

  it("requires authentication", async () => {
    // The stub scheme above always authenticates, so rejection is not
    // meaningfully testable here - public-api.test.js covers the real scheme
    // and the integration tests cover the wired-up route. What matters at this
    // level is that the route is bound to the strategy at all.
    const [route] = server
      .table()
      .filter((r) => r.path === "/api/users/{entraId}/roles");

    expect(route.settings.auth.strategies).toEqual([PUBLIC_API_STRATEGY]);
  });
});
