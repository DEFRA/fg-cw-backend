import { describe, expect, it, vi } from "vitest";
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
      stages: [],
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    });

    expect(save).toHaveBeenCalledWith(workflow);

    expect(workflow).toStrictEqual(
      Workflow.createMock({
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
        stages: [],
      }),
    );
  });
});
