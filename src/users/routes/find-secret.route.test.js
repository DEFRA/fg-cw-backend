import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "../../server/index.js";
import { findSecretRoute } from "./find-secret.route.js";

describe("findSecretRoute", () => {
  let server;

  beforeAll(async () => {
    server = await createServer();
    server.route(findSecretRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns credentials", async () => {
    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/secret",
      auth: {
        strategy: "entra",
        credentials: {
          userId: "12345",
          scope: ["admin"],
        },
      },
    });

    expect(statusCode).toEqual(200);

    expect(result).toEqual({
      userId: "12345",
      scope: ["admin"],
    });
  });
});
