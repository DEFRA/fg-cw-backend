import { describe, expect, it } from "vitest";
import { RequiredAppRoles } from "./required-app-roles.js";

describe("RequiredAppRoles", () => {
  it("initialises with provided allOf and anyOf arrays", () => {
    const roles = new RequiredAppRoles({
      allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
      anyOf: ["ROLE_EDITOR", "ROLE_VIEWER"],
    });

    expect(roles.allOf).toEqual(["ROLE_ADMIN", "ROLE_MANAGER"]);
    expect(roles.anyOf).toEqual(["ROLE_EDITOR", "ROLE_VIEWER"]);
  });
});
