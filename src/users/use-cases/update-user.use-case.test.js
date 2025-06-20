import { describe, expect, it, vi } from "vitest";
import { update } from "../repositories/user.repository.js";
import { updateUserUseCase } from "./update-user.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("updateUserUseCase", () => {
  it("updates the status of a task", async () => {
    await updateUserUseCase({
      userId: "user-123",
      props: {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@defra.co.uk",
        roles: {
          idp: [],
          app: [],
        },
      },
    });

    expect(update).toHaveBeenCalledWith("user-123", {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@defra.co.uk",
      roles: {
        idp: [],
        app: [],
      },
    });
  });
});
