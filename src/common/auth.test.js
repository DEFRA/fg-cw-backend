import { describe, expect, it } from "vitest";
import { getAuthenticatedUserRoles } from "./auth.js";

describe("auth - getAuthenticatedUserRoles", () => {
  it("should return roles", () => {
    expect(getAuthenticatedUserRoles()).toEqual({
      ROLE_RPA: {},
      ROLE_RPA_ADMIN: {},
      ROLE_FLYING_PIGS: {},
      ROLE_1: {},
      ROLE_2: {},
      ROLE_3: {},
    });
  });
});
