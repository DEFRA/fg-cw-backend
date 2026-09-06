import { beforeEach, describe, expect, it, vi } from "vitest";
import { entraStrategyOptions } from "./entra.js";

describe("entra strategy options", () => {
  let validate;
  let mockFindAll;

  const artifactsFor = (roles) => ({
    decoded: {
      payload: { oid: "user-id-123", name: "Test User", roles },
    },
  });

  beforeEach(() => {
    const mockConfig = {
      get: vi.fn(
        (key) =>
          ({
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
          })[key],
      ),
    };

    mockFindAll = vi.fn().mockResolvedValue([]);

    ({ validate } = entraStrategyOptions({
      config: mockConfig,
      findAll: mockFindAll,
    }));
  });

  it("verifies against the configured issuer, audience and JWKS", () => {
    const options = entraStrategyOptions({
      config: {
        get: vi.fn((key) =>
          key === "oidc.jwks.uri" ? "https://jwks" : `value:${key}`,
        ),
      },
      findAll: mockFindAll,
    });

    expect(options.keys.uri).toBe("https://jwks");
    expect(options.verify).toMatchObject({
      iss: "value:oidc.verify.iss",
      aud: "value:oidc.verify.aud",
      exp: true,
      nbf: true,
    });
  });

  it("should return valid when user has matching roles and no database user", async () => {
    const result = await validate(artifactsFor(["FCP.Casework.Read"]));

    expect(result.isValid).toBe(true);
    expect(result.credentials.raw).toEqual({
      idpId: "user-id-123",
      name: "Test User",
      idpRoles: ["FCP.Casework.Read"],
    });
    expect(result.credentials.user).toBe(null);
  });

  it("should return valid when user has multiple matching roles", async () => {
    const result = await validate(
      artifactsFor(["FCP.Casework.Read", "FCP.Casework.ReadWrite", "Unknown"]),
    );

    expect(result.isValid).toBe(true);
    expect(result.credentials.raw.idpRoles).toEqual(
      expect.arrayContaining(["FCP.Casework.Read", "FCP.Casework.ReadWrite"]),
    );
  });

  it("should return valid with database user when user exists", async () => {
    const mockUser = { id: "db-user-id", name: "DB User" };
    mockFindAll.mockResolvedValue([mockUser]);

    const result = await validate(artifactsFor(["FCP.Casework.Admin"]));

    expect(mockFindAll).toHaveBeenCalledWith({ idpId: "user-id-123" });
    expect(result.isValid).toBe(true);
    expect(result.credentials.user).toBe(mockUser);
  });

  it("should return invalid when user has no matching roles", async () => {
    const result = await validate(artifactsFor(["UnknownRole", "AnotherOne"]));

    expect(result.isValid).toBe(false);
    expect(result.credentials.raw.idpRoles).toEqual([]);
  });

  it("should return invalid when user has no roles", async () => {
    const result = await validate(artifactsFor([]));

    expect(result.isValid).toBe(false);
  });
});
