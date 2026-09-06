import hapi from "@hapi/hapi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findById } from "./access-token.repository.js";
import { hashToken } from "./hash-token.js";
import {
  PUBLIC_API_STRATEGY,
  SERVICE_TOKEN_SCHEME,
  serviceTokenScheme,
} from "./public-api.js";

vi.mock("./access-token.repository.js", () => ({ findById: vi.fn() }));

const RAW_TOKEN = "d4b6b8e1-0c2c-4a4a-9b4b-1b2c3d4e5f60";

describe("public-api auth", () => {
  let server;

  const inject = (headers) =>
    server.inject({ method: "GET", url: "/actuators/thing", headers });

  beforeEach(async () => {
    findById.mockResolvedValue({
      id: hashToken(RAW_TOKEN),
      client: "fg-gas-backend",
      expiresAt: null,
    });

    server = hapi.server();
    server.auth.scheme(SERVICE_TOKEN_SCHEME, serviceTokenScheme);
    server.auth.strategy(PUBLIC_API_STRATEGY, SERVICE_TOKEN_SCHEME);

    server.route({
      method: "GET",
      path: "/actuators/thing",
      options: { auth: PUBLIC_API_STRATEGY },
      handler: (request) => request.auth.credentials,
    });

    await server.initialize();
  });

  it("authenticates a valid bearer token and exposes the caller", async () => {
    const res = await inject({ authorization: `Bearer ${RAW_TOKEN}` });

    expect(res.statusCode).toBe(200);
    expect(res.result).toEqual({
      service: "fg-gas-backend",
      tokenId: hashToken(RAW_TOKEN),
    });
  });

  it("looks the token up by its sha256 hash, never the raw value", async () => {
    await inject({ authorization: `Bearer ${RAW_TOKEN}` });

    expect(findById).toHaveBeenCalledWith(hashToken(RAW_TOKEN));
    expect(findById).not.toHaveBeenCalledWith(RAW_TOKEN);
  });

  it("tolerates whitespace around the token", async () => {
    const res = await inject({ authorization: `Bearer   ${RAW_TOKEN}   ` });

    expect(res.statusCode).toBe(200);
  });

  it.each(["bearer", "BEARER", "BeArEr"])(
    "accepts %s, since RFC 7235 makes the scheme case-insensitive",
    async (scheme) => {
      const res = await inject({ authorization: `${scheme} ${RAW_TOKEN}` });

      expect(res.statusCode).toBe(200);
    },
  );

  it("challenges with WWW-Authenticate on rejection", async () => {
    findById.mockResolvedValue(null);

    const res = await inject({ authorization: "Bearer nope" });

    expect(res.headers["www-authenticate"]).toMatch(/^Bearer/);
  });

  it("rejects a token with no matching record", async () => {
    findById.mockResolvedValue(null);

    const res = await inject({ authorization: "Bearer nope" });

    expect(res.statusCode).toBe(401);
  });

  it("rejects an expired token", async () => {
    findById.mockResolvedValue({
      id: hashToken(RAW_TOKEN),
      client: "fg-gas-backend",
      expiresAt: new Date("2000-01-01T00:00:00Z"),
    });

    const res = await inject({ authorization: `Bearer ${RAW_TOKEN}` });

    expect(res.statusCode).toBe(401);
  });

  it("accepts a token whose expiry is still in the future", async () => {
    findById.mockResolvedValue({
      id: hashToken(RAW_TOKEN),
      client: "fg-gas-backend",
      expiresAt: new Date("3000-01-01T00:00:00Z"),
    });

    const res = await inject({ authorization: `Bearer ${RAW_TOKEN}` });

    expect(res.statusCode).toBe(200);
  });

  it.each([
    ["no authorization header", undefined],
    ["an empty header", ""],
    ["an Entra-shaped header with the wrong scheme", "Basic Zm9vOmJhcg=="],
    ["a bare token", RAW_TOKEN],
  ])(
    "rejects a request with %s without hitting the database",
    async (_, value) => {
      const res = await inject(
        value === undefined ? {} : { authorization: value },
      );

      expect(res.statusCode).toBe(401);
      expect(findById).not.toHaveBeenCalled();
    },
  );
});

describe("strategy composition", () => {
  let server;

  beforeEach(async () => {
    server = hapi.server();
    server.auth.scheme(SERVICE_TOKEN_SCHEME, serviceTokenScheme);
    server.auth.strategy(PUBLIC_API_STRATEGY, SERVICE_TOKEN_SCHEME);
    server.auth.scheme("always", () => ({
      authenticate: (request, h) =>
        h.authenticated({ credentials: { user: "entra-user" } }),
    }));
    server.auth.strategy("fallback", "always");

    server.route({
      method: "GET",
      path: "/dual",
      options: { auth: { strategies: [PUBLIC_API_STRATEGY, "fallback"] } },
      handler: (request) => request.auth.credentials,
    });

    await server.initialize();
  });

  it("falls through to the next strategy when no bearer token is sent", async () => {
    const res = await server.inject({ method: "GET", url: "/dual" });

    expect(res.statusCode).toBe(200);
    expect(res.result).toEqual({ user: "entra-user" });
  });

  it("does not fall through when a bearer token is present but invalid", async () => {
    findById.mockResolvedValue(null);

    const res = await server.inject({
      method: "GET",
      url: "/dual",
      headers: { authorization: "Bearer nope" },
    });

    expect(res.statusCode).toBe(401);
  });
});
