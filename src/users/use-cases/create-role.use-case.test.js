import { describe, expect, it, vi } from "vitest";
import { Role } from "../models/role.js";
import { createRoleUseCase } from "./create-role.use-case.js";

vi.mock("../repositories/role.repository.js");

describe("createRoleUseCase", () => {
  it("creates a role", async () => {
    const props = {
      code: "TEST.ROLE",
      description: "Test role description",
    };

    const result = await createRoleUseCase(props);

    expect(result).toBeInstanceOf(Role);
    expect(result.code).toBe(props.code);
    expect(result.description).toBe(props.description);
    expect(result.id).toBeDefined();
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });
});
