import { describe, expect, it } from "vitest";
import { Permissions } from "./permissions.js";

describe("Permissions", () => {
  it("initialises with empty arrays if no props provided", () => {
    const permissions = new Permissions({});
    expect(permissions.allOf).toEqual([]);
    expect(permissions.anyOf).toEqual([]);
  });

  it("initialises with provided allOf and anyOf arrays", () => {
    const props = {
      allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
      anyOf: ["ROLE_EDITOR", "ROLE_VIEWER"],
    };
    const permissions = new Permissions(props);
    expect(permissions.allOf).toEqual(["ROLE_ADMIN", "ROLE_MANAGER"]);
    expect(permissions.anyOf).toEqual(["ROLE_EDITOR", "ROLE_VIEWER"]);
  });

  it("authorised when no permissions are required", () => {
    const permissions = new Permissions({});
    expect(
      permissions.isAuthorised({
        ROLE_USER: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(true);
    expect(permissions.isAuthorised({})).toBe(true);
  });

  it("authorised when user has all required allOf roles", () => {
    const permissions = new Permissions({
      allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
    });
    expect(
      permissions.isAuthorised({
        ROLE_USER: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_ADMIN: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_MANAGER: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(true);
  });

  it("not authorised when user is missing any allOf role", () => {
    const permissions = new Permissions({
      allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
    });
    expect(
      permissions.isAuthorised({
        ROLE_ADMIN: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_USER: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("not authorised when user has none of the allOf roles", () => {
    const permissions = new Permissions({
      allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
    });
    expect(
      permissions.isAuthorised({
        ROLE_ADMIN: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_VIEWER: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("authorised when user has any of the required anyOf roles", () => {
    const permissions = new Permissions({
      anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
    });

    expect(
      permissions.isAuthorised({
        ROLE_USER: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_EDITOR: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(true);
  });

  it("not authorised when user has none of the anyOf roles", () => {
    const permissions = new Permissions({
      anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
    });
    expect(
      permissions.isAuthorised({
        ROLE_ADMIN: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_VIEWER: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("authorised when user has allOf and anyOf roles", () => {
    const permissions = new Permissions({
      allOf: ["ROLE_ADMIN"],
      anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
    });

    expect(
      permissions.isAuthorised({
        ROLE_ADMIN: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_EDITOR: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(true);
  });

  it("not authorised when user has allOf roles but not anyOf role", () => {
    const permissions = new Permissions({
      allOf: ["ROLE_ADMIN"],
      anyOf: ["ROLE_EDITOR"],
    });
    expect(
      permissions.isAuthorised({
        ROLE_ADMIN: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_MANAGER: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("not authorised when user has anyOf role but not allOf roles", () => {
    const permissions = new Permissions({
      allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
      anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
    });
    expect(
      permissions.isAuthorised({
        ROLE_ADMIN: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
        ROLE_EDITOR: {
          startDate: "2025-07-01T00:00:00.000Z",
          endDate: "2025-08-02T00:00:00.000Z",
        },
      }),
    ).toBe(false);
  });

  it("not authorised when use has no roles", () => {
    const permissions = new Permissions({
      allOf: ["ROLE_ADMIN", "ROLE_MANAGER"],
      anyOf: ["ROLE_EDITOR", "ROLE_REVIEWER"],
    });
    expect(permissions.isAuthorised({})).toBe(false);
  });
});
