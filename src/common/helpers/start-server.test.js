import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import hapi from "@hapi/hapi";
import { createServer } from "../../server.js";
import { startServer } from "./start-server.js";

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

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
vi.mock("./logging/logger.js", () => ({
  createLogger: () => ({
    info: mockLoggerInfo,
    error: mockLoggerError
  })
}));
vi.mock("../../server.js", { spy: true });
vi.mock("./start-server.js", { spy: true });

describe.skip("#startServer", () => {
  let hapiServerSpy;

  beforeAll(async () => {
    hapiServerSpy = vi.spyOn(hapi, "server");
  });

  describe("When server starts", () => {
    let server;

    afterAll(async () => {
      await server.stop({ timeout: 0 });
    });

    test("Should start up server as expected", async () => {
      const server = await startServer("localhost", 3098);
      expect(createServer).toHaveBeenCalled();
      expect(hapiServerSpy).toHaveBeenCalled();
      expect(server.logger.info).toHaveBeenNthCalledWith(
        1,
        "Custom secure context is disabled"
      );
      expect(server.logger.info).toHaveBeenNthCalledWith(
        2,
        "Setting up MongoDb"
      );
      expect(server.logger.info).toHaveBeenNthCalledWith(
        3,
        "MongoDb connected to fg-cw-backend"
      );
      expect(server.logger.info).toHaveBeenNthCalledWith(
        4,
        "Server started successfully"
      );
      expect(server.logger.info).toHaveBeenNthCalledWith(
        5,
        "Access your backend on http://localhost:3098"
      );
    });
  });

  describe("When server start fails", () => {
    beforeAll(() => {
      createServer.mockRejectedValue(new Error("Server failed to start"));
    });

    test("Should log failed startup message", async () => {
      await startServer();

      expect(mockLoggerInfo).toHaveBeenCalledWith("Server failed to start :(");
      expect(mockLoggerError).toHaveBeenCalledWith(
        Error("Server failed to start")
      );
    });
  });
});
