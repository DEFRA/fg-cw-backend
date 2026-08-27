import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "./index.js";

describe("auth plugin", () => {
  let server;

  beforeEach(async () => {
    server = {
      register: vi.fn(),
      auth: {
        default: vi.fn(),
        scheme: vi.fn(),
        strategy: vi.fn(),
      },
    };

    await auth.register(server);
  });

  it("registers the entra strategy for the BFF surface", () => {
    expect(server.auth.strategy).toHaveBeenCalledWith(
      "entra",
      "jwt",
      expect.objectContaining({ validate: expect.any(Function) }),
    );
  });

  it("registers the public API strategy on the service-token scheme", () => {
    expect(server.auth.scheme).toHaveBeenCalledWith(
      "service-token",
      expect.any(Function),
    );
    expect(server.auth.strategy).toHaveBeenCalledWith(
      "public-api",
      "service-token",
    );
  });

  it("applies entra to every route by default, and nothing else", () => {
    expect(server.auth.default).toHaveBeenCalledTimes(1);
    expect(server.auth.default).toHaveBeenCalledWith("entra");
  });
});
