import { describe, it, expect } from "vitest";
import { health } from "./health";

describe("Health Route", () => {
  it("should define the correct route method", () => {
    expect(health).toHaveProperty("method", "GET");
  });

  it("should define the correct route path", () => {
    expect(health).toHaveProperty("path", "/health");
  });

  it("should have a handler function", () => {
    expect(health).toHaveProperty("handler");
    expect(typeof health.handler).toBe("function");
  });

  it("handler should return success message", () => {
    const mockResponseToolkit = {
      response: (payload) => payload // Mock the response method
    };

    const result = health.handler({}, mockResponseToolkit);
    expect(result).toEqual({ message: "success" });
  });
});
