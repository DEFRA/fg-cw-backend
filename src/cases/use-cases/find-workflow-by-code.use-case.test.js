import { describe, expect, it, vi } from "vitest";
import { Workflow } from "../models/workflow.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../repositories/workflow.repository.js");

describe("findWorkflowByCodeUseCase", () => {
  it("finds a workflow by code", async () => {
    const workflow1 = new Workflow({
      code: "wf-001",
      pages: {
        cases: {
          details: {
            banner: { summary: {} },
            tabs: { caseDetails: { title: "Test", sections: [] } },
          },
        },
      },
      stages: [
        {
          code: "STAGE_1",
          taskGroups: [
            {
              code: "TASK_GROUP_1",
              tasks: [
                {
                  code: "TASK_1",
                  type: "task-type-1",
                },
              ],
            },
          ],
        },
      ],
    });

    findByCode.mockResolvedValue(workflow1);

    const workflows = await findWorkflowByCodeUseCase("wf-001");

    expect(workflows).toStrictEqual(workflow1);
  });

  it("throws when workflow not found", async () => {
    findByCode.mockResolvedValue(null);

    await expect(
      findWorkflowByCodeUseCase("non-existent-code"),
    ).rejects.toThrow('Workflow with code "non-existent-code" not found');
  });
});
