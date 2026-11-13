import { beforeEach, describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { buildCaseFilter } from "./build-case-filter.js";
import { createRoleFilter } from "./create-role-filter.js";
import { findWorkflowCodesUseCase } from "./find-workflow-codes.use-case.js";

vi.mock("./find-workflow-codes.use-case.js");

const mockCodes = ({ permitted, existing }) =>
  findWorkflowCodesUseCase.mockImplementation(async (query) =>
    query.codes ? existing.filter((c) => query.codes.includes(c)) : permitted,
  );

describe("buildCaseFilter", () => {
  const user = User.createMock();

  beforeEach(() => {
    mockCodes({ permitted: ["WF-A", "WF-B"], existing: ["WF-A", "WF-B"] });
  });

  it("returns all permitted workflow codes when no caseType is supplied", async () => {
    const result = await buildCaseFilter({ user });

    expect(result).toEqual({ workflowCodes: ["WF-A", "WF-B"] });
  });

  it("queries permitted codes with the user's role filter", async () => {
    await buildCaseFilter({ user });

    expect(findWorkflowCodesUseCase).toHaveBeenCalledWith(
      createRoleFilter(user.getRoles()),
    );
  });

  it("does not look up the case type when caseType is absent", async () => {
    await buildCaseFilter({ user });

    expect(findWorkflowCodesUseCase).toHaveBeenCalledTimes(1);
  });

  it("returns a single workflow code when caseType is valid and permitted", async () => {
    const result = await buildCaseFilter({ user, caseType: "WF-A" });

    expect(result).toEqual({ workflowCodes: ["WF-A"] });
    expect(findWorkflowCodesUseCase).toHaveBeenCalledWith({ codes: ["WF-A"] });
  });

  it("throws 404 when caseType does not exist", async () => {
    const error = await buildCaseFilter({
      user,
      caseType: "DOES-NOT-EXIST",
    }).catch((e) => e);

    expect(error.isBoom).toBe(true);
    expect(error.output.statusCode).toBe(404);
  });

  it("throws 403 when caseType exists but user lacks required roles", async () => {
    mockCodes({
      permitted: ["WF-A", "WF-B"],
      existing: ["WF-A", "WF-B", "WF-RESTRICTED"],
    });

    const error = await buildCaseFilter({
      user,
      caseType: "WF-RESTRICTED",
    }).catch((e) => e);

    expect(error.isBoom).toBe(true);
    expect(error.output.statusCode).toBe(403);
  });
});
