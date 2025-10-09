import { describe, expect, it } from "vitest";
import { createServer } from "./index.js";

describe("server", () => {
  it("strips trailing slashes", async () => {
    const server = await createServer();

    server.route({
      method: "GET",
      path: "/path",
      options: {
        auth: false,
      },
      handler: () => "Hello, World!",
    });

    await server.initialize();

    const response = await server.inject({
      method: "GET",
      url: "/path/",
    });

    expect(response.statusCode).toBe(200);
    expect(response.request.url.pathname).toBe("/path");
  });

  it("serves swagger", async () => {
    const server = await createServer();
    await server.initialize();

    const routes = server.table().map((r) => ({
      path: r.path,
      method: r.method,
    }));

    const swaggerJsonResponse = await server.inject({
      method: "GET",
      url: "/swagger.json",
    });

    expect(swaggerJsonResponse.result.info).toEqual({
      title: "Case Working Service",
      version: "0.0.1",
    });

    expect(routes).toEqual(
      expect.arrayContaining([
        {
          method: "get",
          path: "/documentation",
        },
      ]),
    );
  });

  it("serves health check", async () => {
    const server = await createServer();
    await server.initialize();

    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual({
      message: "success",
    });
  });

  it("restricts access to protected routes", async () => {
    const server = await createServer();

    server.route({
      method: "GET",
      path: "/protected",
      options: {
        auth: "entra",
      },
      handler: () => "OK",
    });

    await server.initialize();

    const response = await server.inject({
      method: "GET",
      url: "/protected",
    });

    expect(response.statusCode).toBe(401);
  });
});
