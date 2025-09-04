import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthPlugin } from "./auth.js";

describe("auth validate function", () => {
  let validateFn;
  let server;
  let mockConfig;
  let mockFindAll;
  let mockJwt;

  beforeEach(async () => {
    server = {
      register: vi.fn(),
      auth: {
        strategy: vi.fn(),
      },
    };

    mockConfig = {
      get: vi.fn((key) => {
        const configMap = {
          entra: {
            roles: [
              "FCP.Casework.Read",
              "FCP.Casework.ReadWrite",
              "FCP.Casework.Admin",
            ],
          },
          "oidc.jwks.uri": "https://example.com/.well-known/jwks.json",
          "oidc.verify.iss": "https://login.microsoftonline.com/tenant/v2.0",
          "oidc.verify.aud": "api://test-app",
        };
        return configMap[key];
      }),
    };

    mockFindAll = vi.fn().mockResolvedValue([]);

    mockJwt = {
      register: vi.fn(),
    };

    const auth = createAuthPlugin({
      jwtPlugin: mockJwt,
      config: mockConfig,
      findAll: mockFindAll,
    });

    await auth.register(server);
    // extract validate function for testing
    validateFn = server.auth.strategy.mock.calls[0][2].validate;
  });

  it("should return valid when user has matching roles and no database user", async () => {
    const artifacts = {
      decoded: {
        payload: {
          oid: "user-id-123",
          name: "Test User",
          roles: ["FCP.Casework.Read"],
        },
      },
    };

    const result = await validateFn(artifacts);

    expect(result.isValid).toBe(true);
    expect(result.credentials.raw).toEqual({
      idpId: "user-id-123",
      name: "Test User",
      idpRoles: ["FCP.Casework.Read"],
    });
    expect(result.credentials.user).toBe(null);
  });

  it("should return valid when user has multiple matching roles", async () => {
    const artifacts = {
      decoded: {
        payload: {
          oid: "user-id-123",
          name: "Test User",
          roles: ["FCP.Casework.Read", "FCP.Casework.ReadWrite", "UnknownRole"],
        },
      },
    };

    const result = await validateFn(artifacts);

    expect(result.isValid).toBe(true);
    expect(result.credentials.raw.idpRoles).toEqual(
      expect.arrayContaining(["FCP.Casework.Read", "FCP.Casework.ReadWrite"]),
    );
  });

  it("should return valid with database user when user exists", async () => {
    const mockUser = { id: "db-user-id", name: "DB User" };
    mockFindAll.mockResolvedValue([mockUser]);

    const artifacts = {
      decoded: {
        payload: {
          oid: "user-id-123",
          name: "Test User",
          roles: ["FCP.Casework.Admin"],
        },
      },
    };

    const result = await validateFn(artifacts);

    expect(mockFindAll).toHaveBeenCalledWith({
      idpId: "user-id-123",
    });
    expect(result.isValid).toBe(true);
    expect(result.credentials.user).toBe(mockUser);
  });

  it("should return invalid when user has no matching roles", async () => {
    const artifacts = {
      decoded: {
        payload: {
          oid: "user-id-123",
          name: "Test User",
          roles: ["UnknownRole", "AnotherUnknownRole"],
        },
      },
    };

    const result = await validateFn(artifacts);

    expect(result.isValid).toBe(false);
    expect(result.credentials.raw.idpRoles).toEqual([]);
  });

  it("should return invalid when user has no roles", async () => {
    const artifacts = {
      decoded: {
        payload: {
          oid: "user-id-123",
          name: "Test User",
          roles: [],
        },
      },
    };

    const result = await validateFn(artifacts);

    expect(result.isValid).toBe(false);
  });
});
