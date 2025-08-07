import { describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { findAll } from "../repositories/user.repository.js";
import { findUsersUseCase } from "./find-users.use-case.js";

vi.mock("../repositories/user.repository.js");

describe("findUsersUseCase", () => {
  it("finds users", async () => {
    const query = { idpId: "test-idp-id" };
    const result = [User.createMock(), User.createMock()];

    findAll.mockResolvedValue(result);

    const cases = await findUsersUseCase(query);

    expect(cases).toEqual(result);
    expect(findAll).toHaveBeenCalledWith(query);
  });
});
