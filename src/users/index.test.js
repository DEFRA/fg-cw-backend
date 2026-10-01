import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../server/index.js";
import { PUBLIC_API_STRATEGY } from "../server/plugins/auth/public-api.js";
import { users } from "./index.js";

vi.mock("migrate-mongo");
vi.mock("../common/mongo-client.js");
vi.mock("./subscribers/create-new-case.subscriber.js");

describe("users", () => {
  let server;

  beforeEach(async () => {
    server = await createServer();
  });

  it("registers routes", async () => {
    await server.register(users);
    await server.initialize();

    const routes = server.table().map((r) => ({
      path: r.path,
      method: r.method,
    }));

    expect(routes).toEqual(
      expect.arrayContaining([
        {
          method: "post",
          path: "/admin/users",
        },
        {
          method: "patch",
          path: "/admin/users/{userId}",
        },
        {
          method: "post",
          path: "/roles",
        },
        {
          method: "get",
          path: "/roles",
        },
        {
          method: "get",
          path: "/roles/{code}",
        },
        {
          method: "get",
          path: "/api/users/{entraId}/roles",
        },
      ]),
    );
  });

  // Losing the explicit `auth` would silently fall back to the server's Entra
  // default, exposing the route to every logged-in caseworker.
  it("serves the roles API on the public API strategy", async () => {
    await server.register(users);
    await server.initialize();

    const [route] = server
      .table()
      .filter((r) => r.path === "/api/users/{entraId}/roles");

    expect(route.settings.auth.strategies).toEqual([PUBLIC_API_STRATEGY]);
  });
});
