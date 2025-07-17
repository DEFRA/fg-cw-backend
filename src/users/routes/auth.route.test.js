import { describe, expect, it, vi } from "vitest";
import { authRoute } from "./auth.route.js";

describe("Auth Route", () => {
  it("should define the correct HTTP method and path", () => {
    expect(authRoute.method).toBe("POST");
    expect(authRoute.path).toBe("/auth/token");
  });

  it("should have the correct route options", () => {
    const options = authRoute.options;

    expect(options.description).toBe("Accept an access token");
    expect(options.tags).toContain("api");
    expect(options.validate).toBeDefined();
    expect(options.validate.payload).toBeDefined();
    expect(options.validate.payload.accessToken).toBeDefined();
    expect(options.validate.payload.accessToken._flags.presence).toBe(
      "required",
    );
  });

  it("should return a 200 response with the received token", async () => {
    const mockHandler = authRoute.handler;
    const mockRequest = {
      payload: {
        accessToken: "testAccessToken",
      },
    };
    const mockResponse = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn(),
    };

    await mockHandler(mockRequest, mockResponse);

    expect(mockResponse.response).toHaveBeenCalledWith({
      message: "Token received",
      accessToken: "testAccessToken",
    });

    expect(mockResponse.code).toHaveBeenCalledWith(200);
  });
});
