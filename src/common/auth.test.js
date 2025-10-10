import { describe, expect, it } from "vitest";
import { getAuthenticatedUser, getAuthenticatedUserRoles } from "./auth.js";

describe("auth - getAuthenticatedUserRoles", () => {
  it("should return fallback roles when no auth provided", () => {
    expect(getAuthenticatedUserRoles()).toEqual({
      ROLE_RPA: {},
      ROLE_RPA_ADMIN: {},
      ROLE_FLYING_PIGS: {},
      ROLE_1: {},
      ROLE_2: {},
      ROLE_3: {},
    });
  });

  it("should return roles from auth credentials when provided", () => {
    const auth = {
      credentials: {
        raw: {
          idpRoles: ["ROLE_ADMIN", "ROLE_USER"],
        },
      },
    };

    expect(getAuthenticatedUserRoles(auth)).toEqual({
      ROLE_ADMIN: {},
      ROLE_USER: {},
    });
  });
});

describe("auth - getAuthenticatedUser", () => {
  it("should return fallback user when no auth provided", () => {
    expect(getAuthenticatedUser()).toEqual({
      id: "System",
      name: "System",
      email: "system@example.com",
    });
  });

  it("should return user from auth credentials when provided", () => {
    const auth = {
      credentials: {
        user: {
          id: "user-123",
          name: "Test User",
          email: "test@example.com",
        },
      },
    };

    expect(getAuthenticatedUser(auth)).toEqual({
      id: "user-123",
      name: "Test User",
      email: "test@example.com",
    });
  });
});
