import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { logger } from "../common/logger.js";
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

  it("logs an answer to a person's own mistake at its level, with no stack", async () => {
    const info = vi.spyOn(logger, "info");
    const error = vi.spyOn(logger, "error");
    const server = await createServer();

    server.route({
      method: "POST",
      path: "/asked",
      options: { auth: false },
      handler: () => {
        throw new Boom.Boom("EXPLORE_QUERY_REFUSED", {
          statusCode: 400,
          data: { logLevel: "info" },
        });
      },
    });

    await server.initialize();

    const { statusCode } = await server.inject({
      method: "POST",
      url: "/asked",
    });

    expect(statusCode).toBe(400);
    expect(info).toHaveBeenCalledWith("400 /asked: EXPLORE_QUERY_REFUSED");
    expect(error).not.toHaveBeenCalled();
  });
});
