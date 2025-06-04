import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import hapi from "@hapi/hapi";
import { createServer } from "../server.js";
import { startServer } from "./start-server.js";
import { logger } from "./logger.js";

vi.mock("hapi-pino", () => ({
  default: {
    register: (server) => {
      server.decorate("server", "logger", {
        info: vi.fn(),
        error: vi.fn()
      });
    },
    name: "mock-hapi-pino"
  }
}));

vi.mock("../../server.js", { spy: true });
vi.mock("./start-server.js", { spy: true });

describe.skip("#startServer", () => {
  let hapiServerSpy;

  beforeAll(async () => {
    hapiServerSpy = vi.spyOn(hapi, "server");
    vi.spyOn(logger, "info").mockImplementation(() => {});
    vi.spyOn(logger, "error").mockImplementation(() => {});
  });

  describe("When server starts", () => {
    let server;

    afterAll(async () => {
      await server.stop({ timeout: 0 });
    });

    it("Should start up server as expected", async () => {
      await startServer("localhost", 3098);
      expect(createServer).toHaveBeenCalled();
      expect(hapiServerSpy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenNthCalledWith(
        1,
        "Custom secure context is disabled"
      );
      expect(logger.info).toHaveBeenNthCalledWith(2, "Setting up MongoDb");
      expect(logger.info).toHaveBeenNthCalledWith(
        3,
        "MongoDb connected to fg-cw-backend"
      );
      expect(logger.info).toHaveBeenNthCalledWith(
        4,
        "Server started successfully"
      );
      expect(logger.info).toHaveBeenNthCalledWith(
        5,
        "Access your backend on http://localhost:3098"
      );
    });
  });

  describe("When server start fails", () => {
    beforeAll(() => {
      createServer.mockRejectedValue(new Error("Server failed to start"));
    });

    it("Should log failed startup message", async () => {
      await startServer();

      expect(logger.info).toHaveBeenCalledWith("Server failed to start :(");
      expect(logger.error).toHaveBeenCalledWith(
        Error("Server failed to start")
      );
    });
  });
});
