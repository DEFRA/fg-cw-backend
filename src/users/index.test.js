import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../common/mongo-client.js";
import { createServer } from "../server/index.js";
import { users } from "./index.js";

vi.mock("migrate-mongo");
vi.mock("../common/mongo-client.js");
vi.mock("./subscribers/create-new-case.subscriber.js");

describe("users", () => {
  let server;

  beforeEach(async () => {
    server = await createServer();
  });

  it("creates indexes on startup", async () => {
    await server.register(users);
    await server.initialize();

    expect(db.createIndex).toHaveBeenCalledWith(
      "users",
      { idpId: 1, email: 1 },
      { unique: true },
    );
    expect(db.createIndex).toHaveBeenCalledWith(
      "roles",
      { code: 1 },
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

    expect(routes).toEqual(
      expect.arrayContaining([
        {
          method: "post",
          path: "/roles",
        },
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
          path: "/roles",
        },
        {
          method: "get",
          path: "/secret",
        },
        {
          method: "get",
          path: "/users",
        },
        {
          method: "get",
          path: "/roles/{code}",
        },
        {
          method: "get",
          path: "/users/{userId}",
        },
      ]),
    );
  });
});
