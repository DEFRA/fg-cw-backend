import { describe, expect, it, vi } from "vitest";
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
      userId,
      props: {
        name: "Name",
        idpRoles: ["FCP.Casework.Read"],
        appRoles: ["CW-Admin"],
      },
    });

    expect(update).toHaveBeenCalledWith(
      new User({
        id: userId,
        idpId,
        name: "Name",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["FCP.Casework.Read"],
        appRoles: ["CW-Admin"],
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
        appRoles: ["CW-Admin"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
  });

  it("does not update immutable props", async () => {
    const userId = "user-123";
    const idpId = "5de72998-417c-4b7c-815b-62bb77c25d82";

    const user = User.createMock({
      id: userId,
      idpId,
    });

    findById.mockResolvedValue(user);

    await updateUserUseCase({
      userId,
      props: {
        ipdId: "new-idp-id",
        email: "new.email@defra.gov.uk",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    });

    expect(update).toHaveBeenCalledWith(
      new User({
        id: userId,
        idpId,
        name: "Bob Bill",
        email: "bob.bill@defra.gov.uk",
        idpRoles: ["FCP.Casework.ReadWrite"],
        appRoles: ["ROLE_RPA_CASES_APPROVE"],
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
  });
});
