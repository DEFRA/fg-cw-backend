import hapi from "@hapi/hapi";
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findCredentialByHash } from "../../../clients/repositories/access-token.repository.js";
import { hashToken } from "./hash-token.js";
import {
  PUBLIC_API_STRATEGY,
  SERVICE_TOKEN_SCHEME,
  serviceTokenScheme,
} from "./public-api.js";

vi.mock("../../../clients/repositories/access-token.repository.js", () => ({
  findCredentialByHash: vi.fn(),
}));

const RAW_TOKEN = "d4b6b8e1-0c2c-4a4a-9b4b-1b2c3d4e5f60";
const ROW_ID = new ObjectId("6650c1f2a9e4b1d07c20bd91");

describe("public-api auth", () => {
  let server;

  const inject = (headers) =>
    server.inject({ method: "GET", url: "/actuators/thing", headers });

  beforeEach(async () => {
    findCredentialByHash.mockResolvedValue({
      _id: ROW_ID,
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

  // The row id, never the hash: the credentials travel into routes and use
  // cases, and the hash must not.
  it("authenticates a valid bearer token and exposes the caller and its row", async () => {
    const res = await inject({ authorization: `Bearer ${RAW_TOKEN}` });

    expect(res.statusCode).toBe(200);
    expect(res.result).toEqual({
      service: "fg-gas-backend",
      tokenId: ROW_ID.toHexString(),
    });
    expect(JSON.stringify(res.result)).not.toContain(hashToken(RAW_TOKEN));
  });

  it("looks the token up by its sha256 hash, never the raw value", async () => {
    await inject({ authorization: `Bearer ${RAW_TOKEN}` });

    expect(findCredentialByHash).toHaveBeenCalledWith(hashToken(RAW_TOKEN));
    expect(findCredentialByHash).not.toHaveBeenCalledWith(RAW_TOKEN);
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
    findCredentialByHash.mockResolvedValue(null);

    const res = await inject({ authorization: "Bearer nope" });

    expect(res.headers["www-authenticate"]).toMatch(/^Bearer/);
  });

  it("rejects a token with no matching record", async () => {
    findCredentialByHash.mockResolvedValue(null);

    const res = await inject({ authorization: "Bearer nope" });

    expect(res.statusCode).toBe(401);
  });

  it("rejects an expired token", async () => {
    findCredentialByHash.mockResolvedValue({
      _id: ROW_ID,
      id: hashToken(RAW_TOKEN),
      client: "fg-gas-backend",
      expiresAt: new Date("2000-01-01T00:00:00Z"),
    });

    const res = await inject({ authorization: `Bearer ${RAW_TOKEN}` });

    expect(res.statusCode).toBe(401);
  });

  it("rejects a revoked token, whatever its expiry", async () => {
    findCredentialByHash.mockResolvedValue({
      _id: ROW_ID,
      id: hashToken(RAW_TOKEN),
      client: "fg-gas-backend",
      revokedAt: new Date("2026-01-01T00:00:00Z"),
      expiresAt: null,
    });

    const res = await inject({ authorization: `Bearer ${RAW_TOKEN}` });

    expect(res.statusCode).toBe(401);
  });

  it("accepts a token whose expiry is still in the future", async () => {
    findCredentialByHash.mockResolvedValue({
      _id: ROW_ID,
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
    ["a bearer scheme with no token", "Bearer   "],
    ["an Entra-shaped header with the wrong scheme", "Basic Zm9vOmJhcg=="],
    ["a bare token", RAW_TOKEN],
  ])(
    "rejects a request with %s without hitting the database",
    async (_, value) => {
      const res = await inject(
        value === undefined ? {} : { authorization: value },
      );

      expect(res.statusCode).toBe(401);
      expect(findCredentialByHash).not.toHaveBeenCalled();
    },
  );
});

// The one hashing rule GPA, fg-gas-backend and this service share: SHA-256 of
// the token's UTF-8 bytes, as lowercase hex. GPA and fg-gas-backend assert the
// same vectors, so a token issued by one is accepted by the others.
describe("the shared token hash", () => {
  it.each([
    [
      "fgp-1572-hash-vector",
      "95ef91517beb2901c394cf3294bcbe82077e432cd1aac452bca75b6988fe06cb",
    ],
    [
      "Łukasz-tökén",
      "34d9301d2898869f11c9cd61d688500e7f1147eac94cb4ef70bb2092d97323a9",
    ],
  ])("hashes %s to its fixed vector", (raw, hash) => {
    expect(hashToken(raw)).toBe(hash);
  });

  it("looks a caller up by that vector", async () => {
    const server = hapi.server();
    server.auth.scheme(SERVICE_TOKEN_SCHEME, serviceTokenScheme);
    server.auth.strategy(PUBLIC_API_STRATEGY, SERVICE_TOKEN_SCHEME);
    server.route({
      method: "GET",
      path: "/thing",
      options: { auth: PUBLIC_API_STRATEGY },
      handler: () => "ok",
    });
    findCredentialByHash.mockResolvedValue(null);

    await server.inject({
      method: "GET",
      url: "/thing",
      headers: { authorization: "Bearer fgp-1572-hash-vector" },
    });

    expect(findCredentialByHash).toHaveBeenCalledWith(
      "95ef91517beb2901c394cf3294bcbe82077e432cd1aac452bca75b6988fe06cb",
    );
  });
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
    findCredentialByHash.mockResolvedValue(null);

    const res = await server.inject({
      method: "GET",
      url: "/dual",
      headers: { authorization: "Bearer nope" },
    });

    expect(res.statusCode).toBe(401);
  });
});
