import Boom from "@hapi/boom";
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
});

describe("findUserRolesRoute when authentication fails", () => {
  let rejectingServer;

  beforeAll(async () => {
    rejectingServer = hapi.server();
    rejectingServer.auth.scheme(SERVICE_TOKEN_SCHEME, () => ({
      authenticate: () => {
        throw Boom.unauthorized("Invalid token", "Bearer");
      },
    }));
    rejectingServer.auth.strategy(PUBLIC_API_STRATEGY, SERVICE_TOKEN_SCHEME);
    rejectingServer.auth.default(PUBLIC_API_STRATEGY);
    rejectingServer.route(findUserRolesRoute);
    await rejectingServer.initialize();
  });

  afterAll(async () => {
    await rejectingServer.stop();
  });

  it("returns a 401 with no response body", async () => {
    const response = await rejectingServer.inject({
      method: "GET",
      url: `/api/users/${entraId}/roles`,
    });

    expect(response.statusCode).toEqual(401);
    expect(response.payload).toEqual("");
  });

  it("keeps the WWW-Authenticate challenge on the stripped 401", async () => {
    const response = await rejectingServer.inject({
      method: "GET",
      url: `/api/users/${entraId}/roles`,
    });

    expect(response.headers["www-authenticate"]).toMatch(/^Bearer/);
  });

  // main.js calls createServer (which adds the 4xx log) before registering the
  // users plugin, so the log runs before this route strips the body. Pinned
  // because reversing that order would silently lose failed-auth logging.
  it("still exposes the 401 to a server-level onPreResponse", async () => {
    const seen = [];
    const server = hapi.server();

    server.ext("onPreResponse", (request, h) => {
      const { response } = request;

      if (response.isBoom) {
        seen.push(response.output.statusCode);
      }

      return h.continue;
    });

    server.auth.scheme(SERVICE_TOKEN_SCHEME, () => ({
      authenticate: () => {
        throw Boom.unauthorized("Invalid token", "Bearer");
      },
    }));
    server.auth.strategy(PUBLIC_API_STRATEGY, SERVICE_TOKEN_SCHEME);
    server.auth.default(PUBLIC_API_STRATEGY);
    server.route(findUserRolesRoute);
    await server.initialize();

    const response = await server.inject({
      method: "GET",
      url: `/api/users/${entraId}/roles`,
    });

    expect(seen).toEqual([401]);
    expect(response.payload).toEqual("");

    await server.stop();
  });
});
