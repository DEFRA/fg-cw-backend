// Setup file for contract tests to mock config and logger
import { vi } from "vitest";

// Mock config module globally to avoid validation errors in contract tests
vi.mock("../../src/common/config.js", () => ({
  config: {
    serviceName: "fg-cw-backend",
    cdpEnvironment: "test",
    mongoUri: "mongodb://localhost:27017/test",
    mongoDatabase: "test",
  },
}));

// Mock logger globally
vi.mock("../../src/common/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
