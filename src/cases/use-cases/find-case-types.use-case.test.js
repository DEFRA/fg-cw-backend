import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { findWorkflowCodesUseCase } from "./find-workflow-codes.use-case.js";
import { findCaseTypesUseCase } from "./find-case-types.use-case.js";

vi.mock("./find-workflow-codes.use-case.js");

describe("findCaseTypesUseCase", () => {
  it("throws 403 when user is not admin", async () => {
    const user = User.createMock();

    await expect(() => findCaseTypesUseCase({ user })).rejects.toThrow(
      Boom.forbidden(
        `User ${user.id} does not have required roles to perform action`,
      ),
    );

    expect(findWorkflowCodesUseCase).not.toHaveBeenCalled();
  });

  it("returns all case types sorted by code", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin"],
    });

    findWorkflowCodesUseCase.mockResolvedValue(["zebra", "alpha"]);

    const result = await findCaseTypesUseCase({ user });

    expect(findWorkflowCodesUseCase).toHaveBeenCalledWith();
    expect(result).toEqual([{ code: "alpha" }, { code: "zebra" }]);
  });
});
