import { describe, expect, it, vi } from "vitest";
import { findAllCodes } from "../repositories/workflow.repository.js";
import { findWorkflowCodesUseCase } from "./find-workflow-codes.use-case.js";

vi.mock("../repositories/workflow.repository.js");

describe("findWorkflowCodesUseCase", () => {
  it("finds all workflow codes", async () => {
    const result = ["WORKFLOW_A", "WORKFLOW_B"];

    findAllCodes.mockResolvedValue(result);

    const codes = await findWorkflowCodesUseCase();

    expect(codes).toStrictEqual(result);
  });

  it("finds workflow codes with a query", async () => {
    const result = ["WORKFLOW_A"];

    findAllCodes.mockResolvedValue(result);

    const codes = await findWorkflowCodesUseCase({ codes: [] });

    expect(findAllCodes).toBeCalledWith({ codes: [] });
    expect(codes).toStrictEqual(result);
  });
});
