import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    const user = await createUserUseCase({
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@defra.co.uk",
      roles: {
        idp: ["FCP.Casework.Read"],
        app: ["RPA.Cases.Approve"],
      },
    });

    expect(save).toHaveBeenCalledWith(user);

    expect(user).toStrictEqual(
      User.createMock({
        id: expect.any(String),
      }),
    );
  });
});
