import { describe, expect, it, vi } from "vitest";
import { Permissions } from "../models/permissions.js";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/workflow.repository.js";
import { createWorkflowUseCase } from "./create-workflow.use-case.js";

vi.mock("../repositories/workflow.repository.js");

describe("createWorkflowUseCase", () => {
  it("creates a workflow", async () => {
    const workflow = await createWorkflowUseCase({
      code: "wf-001",
      pages: {
        cases: {
          details: {
            banner: { summary: {} },
            tabs: { caseDetails: { title: "Test", sections: [] } },
          },
        },
      },
      phases: [],
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
      definitions: {
        key1: "value1",
      },
    });

    expect(save).toHaveBeenCalledWith(workflow);

    const expectedWorkflow = new Workflow({
      _id: expect.any(String),
      code: "wf-001",
      pages: {
        cases: {
          details: {
            banner: { summary: {} },
            tabs: { caseDetails: { title: "Test", sections: [] } },
          },
        },
      },
      phases: [],
      requiredRoles: new Permissions({
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      }),
      definitions: {
        key1: "value1",
      },
    });

    expect(workflow).toStrictEqual(expectedWorkflow);
  });
});
