import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdpRoles } from "../models/idp-roles.js";
import { User } from "../models/user.js";
import { save } from "../repositories/user.repository.js";
import { createUserUseCase } from "./create-user.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("createUserUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a user", async () => {
    const authenticatedUser = User.createMock({
      idpRoles: [IdpRoles.Admin],
    });

    const user = await createUserUseCase({
      user: authenticatedUser,
      idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
      name: "Bob Bill",
      email: "bob.bill@defra.gov.uk",
      idpRoles: ["FCP.Casework.ReadWrite"],
      appRoles: {
        ROLE_1: {
          startDate: "2025-07-01",
          endDate: "2100-01-01",
        },
        ROLE_2: {
          startDate: "2025-07-02",
          endDate: "2100-01-02",
        },
        ROLE_3: {
          startDate: "2025-07-03",
          endDate: "2100-01-03",
        },
      },
    });

    expect(save).toHaveBeenCalledWith(user);

    expect(user).toStrictEqual(
      User.createMock({
        id: expect.any(String),
      }),
    );
  });

  it("throws 403 when user does not have Admin role", async () => {
    const authenticatedUser = User.createMock({
      idpRoles: ["FCP.Casework.ReadWrite"],
    });

    try {
      await createUserUseCase({
        user: authenticatedUser,
        idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
        name: "Bob Bill",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["FCP.Casework.ReadWrite"],
        appRoles: {},
      });
      expect.fail("Expected error to be thrown");
    } catch (error) {
      expect(error.isBoom).toBe(true);
      expect(error.output.statusCode).toBe(403);
    }
  });
});
