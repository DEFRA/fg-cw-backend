import { describe, expect, it, vi } from "vitest";
import { appRoles } from "../../../test/helpers/appRoles.js";
import { IdpRoles } from "../models/idp-roles.js";
import { User } from "../models/user.js";
import { findById, update } from "../repositories/user.repository.js";
import { updateUserUseCase } from "./update-user.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("updateUserUseCase", () => {
  it("updates mutable props", async () => {
    const userId = "user-123";
    const idpId = "5de72998-417c-4b7c-815b-62bb77c25d82";

    const user = User.createMock({
      id: userId,
      idpId,
    });

    findById.mockResolvedValue(user);

    const updatedUser = await updateUserUseCase({
      authenticatedUser: {
        id: "admin-user",
        idpRoles: [IdpRoles.Admin],
      },
      userId,
      props: {
        name: "Name",
        idpRoles: ["FCP.Casework.Read"],
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
      },
    });

    expect(update).toHaveBeenCalledWith(
      new User({
        id: userId,
        idpId,
        name: "Name",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["FCP.Casework.Read"],
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );

    expect(updatedUser).toEqual(
      new User({
        id: userId,
        idpId,
        name: "Name",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["FCP.Casework.Read"],
        appRoles: {
          ROLE_ADMIN: {
            startDate: "2025-07-01",
            endDate: "2025-08-02",
          },
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
  });

  it("updates email when provided", async () => {
    const userId = "user-123";
    const user = User.createMock({ id: userId });

    findById.mockResolvedValue(user);

    await updateUserUseCase({
      authenticatedUser: { id: userId },
      userId,
      props: {
        email: "new.email@defra.gov.uk",
      },
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: userId,
        email: "new.email@defra.gov.uk",
      }),
    );
  });

  it("throws forbidden when regular user updates appRoles", async () => {
    const userId = "user-123";
    const idpId = "5de72998-417c-4b7c-815b-62bb77c25d82";

    const user = User.createMock({
      id: userId,
      idpId,
      idpRoles: [IdpRoles.Read],
    });

    findById.mockResolvedValue(user);

    await expect(() =>
      updateUserUseCase({
        authenticatedUser: {
          id: userId,
          idpRoles: [IdpRoles.Read],
        },
        userId,
        props: {
          appRoles: {
            ROLE_ADMIN: {
              startDate: "2025-07-01",
              endDate: "2025-08-02",
            },
          },
        },
      }),
    ).rejects.toThrow("Only admins can update app roles");

    expect(update).not.toHaveBeenCalled();
  });

  it("does not update immutable props", async () => {
    const userId = "user-123";
    const idpId = "5de72998-417c-4b7c-815b-62bb77c25d82";

    const user = User.createMock({
      id: userId,
      idpId,
    });

    const roleProps = {
      ROLE_RPA_CASES_APPROVE: {
        startDate: "2025-07-01",
        endDate: "2025-08-02",
      },
    };

    findById.mockResolvedValue(user);

    await updateUserUseCase({
      authenticatedUser: {
        id: "admin-user",
        idpRoles: [IdpRoles.Admin],
      },
      userId,
      props: {
        ipdId: "new-idp-id",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        appRoles: roleProps,
      },
    });

    expect(update).toHaveBeenCalledWith(
      new User({
        id: userId,
        idpId,
        name: "Bob Bill",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["FCP.Casework.ReadWrite"],
        appRoles,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
  });

  it("allows admin to update another user", async () => {
    const userId = "user-123";
    const idpId = "5de72998-417c-4b7c-815b-62bb77c25d82";

    const user = User.createMock({
      id: userId,
      idpId,
    });

    findById.mockResolvedValue(user);

    await updateUserUseCase({
      authenticatedUser: {
        id: "admin-user-123",
        idpRoles: [IdpRoles.Admin],
      },
      userId,
      props: {
        name: "Name",
      },
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: userId,
        name: "Name",
      }),
    );
  });

  it("allows admin to update their own idpRoles", async () => {
    const userId = "admin-user-123";
    const idpId = "5de72998-417c-4b7c-815b-62bb77c25d82";

    const user = User.createMock({
      id: userId,
      idpId,
      idpRoles: [IdpRoles.Admin],
    });

    findById.mockResolvedValue(user);

    await updateUserUseCase({
      authenticatedUser: {
        id: userId,
        idpRoles: [IdpRoles.Admin],
      },
      userId,
      props: {
        idpRoles: [IdpRoles.Read],
      },
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: userId,
        idpRoles: [IdpRoles.Read],
      }),
    );
  });

  it("throws forbidden when admin updates their own appRoles", async () => {
    await expect(() =>
      updateUserUseCase({
        authenticatedUser: {
          id: "admin-user-123",
          idpRoles: [IdpRoles.Admin],
        },
        userId: "admin-user-123",
        props: {
          appRoles: {
            ROLE_ADMIN: {
              startDate: "2025-07-01",
              endDate: "2025-08-02",
            },
          },
        },
      }),
    ).rejects.toThrow(
      "Admin user admin-user-123 cannot update their own app roles",
    );

    expect(findById).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("throws forbidden when updating another user", async () => {
    await expect(() =>
      updateUserUseCase({
        authenticatedUser: User.createMock({
          id: "different-user",
          idpRoles: [IdpRoles.ReadWrite],
        }),
        userId: "user-123",
        props: {
          name: "Name",
        },
      }),
    ).rejects.toThrow("User different-user cannot update another's details");

    expect(findById).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
