import { describe, test, vi, expect } from "vitest";
import { router } from "./router.js";
import { health } from "../route/health.js";
import { cases } from "../route/cases.js";

vi.mock("../route/health.js", () => ({
  health: { method: "GET", path: "/health", handler: vi.fn() }
}));

vi.mock("../route/cases.js", () => ({
  cases: [
    { method: "GET", path: "/cases", handler: vi.fn() },
    { method: "POST", path: "/cases", handler: vi.fn() }
  ]
}));

describe("router plugin", () => {
  test("should have the correct plugin name", () => {
    expect(router.plugin.name).toBe("router");
  });

  test("should register routes correctly", () => {
    const server = {
      route: vi.fn()
    };
    router.plugin.register(server, {});
    expect(server.route).toHaveBeenCalledWith([health, ...cases]);
  });
});
