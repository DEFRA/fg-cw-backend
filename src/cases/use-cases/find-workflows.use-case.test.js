import { describe, expect, it, vi } from "vitest";
import { Workflow } from "../models/workflow.js";
import { findAll } from "../repositories/workflow.repository.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";

vi.mock("../repositories/workflow.repository.js");

describe("findWorkflowsUseCase", () => {
  it("finds all workflows", async () => {
    const result = [Workflow.createMock(), Workflow.createMock()];

    findAll.mockResolvedValue(result);

    const workflows = await findWorkflowsUseCase();

    expect(workflows).toStrictEqual(result);
  });

  it("finds all workflows with a query", async () => {
    const result = [Workflow.createMock(), Workflow.createMock()];

    findAll.mockResolvedValue(result);

    const workflows = await findWorkflowsUseCase({ codes: [] });

    expect(findAll).toBeCalledWith({ codes: [] });
    expect(workflows).toStrictEqual(result);
  });
});
