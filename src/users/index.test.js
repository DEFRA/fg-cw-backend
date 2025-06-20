import hapi from "@hapi/hapi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../common/mongo-client.js";
import { users } from "./index.js";

vi.mock("migrate-mongo");
vi.mock("../common/mongo-client.js");
vi.mock("./subscribers/create-new-case.subscriber.js");

describe("users", () => {
  let server;

  beforeEach(() => {
    server = hapi.server();
  });

  it("creates indexes on startup", async () => {
    await server.register(users);
    await server.initialize();

    expect(db.createIndex).toHaveBeenCalledWith(
      "users",
      { idpId: 1 },
      { unique: true },
    );
  });

  it("registers routes", async () => {
    await server.register(users);
    await server.initialize();

    const routes = server.table().map((r) => ({
      path: r.path,
      method: r.method,
    }));

    expect(routes).toEqual([
      {
        method: "post",
        path: "/users",
      },
      {
        method: "patch",
        path: "/users/{userId}",
      },
      {
        method: "get",
        path: "/users",
      },
      {
        method: "get",
        path: "/users/{userId}",
      },
    ]);
  });
});
