import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi
} from "vitest";
import hapi from "@hapi/hapi";
import { config } from "../../config.js";
import { secureContext } from "./secure-context.js";
import { logger } from "../logger.js";

const mockAddCACert = vi.hoisted(() => vi.fn());
const mockTlsCreateSecureContext = vi.hoisted(() =>
  vi.fn().mockReturnValue({ context: { addCACert: mockAddCACert } })
);
vi.mock("node:tls", () => ({
  default: { createSecureContext: mockTlsCreateSecureContext }
}));

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

describe("secureContext plugin", () => {
  let server;

  vi.spyOn(logger, "info").mockImplementation(() => {});

  describe("When secure context is disabled", () => {
    beforeEach(async () => {
      config.set("isSecureContextEnabled", false);
      server = hapi.server();
      await server.register([secureContext]);
    });

    afterEach(async () => {
      config.set("isSecureContextEnabled", false);
      await server.stop({ timeout: 0 });
    });

    test("secureContext decorator should not be available", () => {
      expect(logger.info).toHaveBeenCalledWith(
        "Custom secure context is disabled"
      );
    });

    test("Logger should give us disabled message", () => {
      expect(server.secureContext).toBeUndefined();
    });
  });

  describe("When secure context is enabled", () => {
    const PROCESS_ENV = process.env;

    beforeAll(() => {
      process.env = { ...PROCESS_ENV };
      process.env.TRUSTSTORE_ONE = "mock-trust-store-cert-one";
    });

    beforeEach(async () => {
      config.set("isSecureContextEnabled", true);
      server = hapi.server();
      await server.register([secureContext]);
    });

    afterEach(async () => {
      config.set("isSecureContextEnabled", false);
      await server.stop({ timeout: 0 });
    });

    afterAll(() => {
      process.env = PROCESS_ENV;
    });

    test("Original tls.createSecureContext should have been called", () => {
      expect(mockTlsCreateSecureContext).toHaveBeenCalledWith({});
    });

    test("addCACert should have been called", () => {
      expect(mockAddCACert).toHaveBeenCalled();
    });

    test("secureContext decorator should be available", () => {
      expect(server.secureContext).toEqual({
        context: { addCACert: expect.any(Function) }
      });
    });
  });

  describe("When secure context is enabled without TRUSTSTORE_ certs", () => {
    beforeEach(async () => {
      config.set("isSecureContextEnabled", true);
      server = hapi.server();
      await server.register([secureContext]);
    });

    afterEach(async () => {
      config.set("isSecureContextEnabled", false);
      await server.stop({ timeout: 0 });
    });

    test("Should log about not finding any TRUSTSTORE_ certs", () => {
      expect(logger.info).toHaveBeenCalledWith(
        "Could not find any TRUSTSTORE_ certificates"
      );
    });
  });
});
