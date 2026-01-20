import { beforeEach, describe, expect, it, vi } from "vitest";
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
          method: "get",
          path: "/roles",
        },
        {
          method: "get",
          path: "/roles/{code}",
        },
      ]),
    );
  });
});
