import { describe, expect, it, vi } from "vitest";
import { Workflow } from "../models/workflow.js";
import { findAll } from "../repositories/workflow.repository.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";

vi.mock("../repositories/workflow.repository.js");

describe("findWorkflowsUseCase", () => {
  it("finds all workflows", async () => {
    const workflow1 = new Workflow({
      code: "wf-001",
      payloadDefinition: {},
      stages: [
        {
          id: "stage-1",
          taskGroups: [
            {
              id: "task-group-1",
              tasks: [
                {
                  id: "task-1",
                  type: "task-type-1",
                  payloadDefinition: {},
                },
              ],
            },
          ],
        },
      ],
    });

    const workflow2 = new Workflow({
      code: "wf-002",
      payloadDefinition: {},
      stages: [
        {
          id: "stage-2",
          taskGroups: [
            {
              id: "task-group-2",
              tasks: [
                {
                  id: "task-2",
                  type: "task-type-2",
                  payloadDefinition: {},
                },
              ],
            },
          ],
        },
      ],
    });

    findAll.mockResolvedValue([workflow1, workflow2]);

    const workflows = await findWorkflowsUseCase({});

    expect(workflows).toStrictEqual([workflow1, workflow2]);
  });
});
