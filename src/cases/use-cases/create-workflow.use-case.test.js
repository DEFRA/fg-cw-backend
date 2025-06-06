import { describe, expect, it, vi } from "vitest";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/workflow.repository.js";
import { createWorkflowUseCase } from "./create-workflow.use-case.js";

vi.mock("../repositories/workflow.repository.js");

describe("createWorkflowUseCase", () => {
  it("creates a workflow", async () => {
    const workflow = await createWorkflowUseCase({
      code: "wf-001",
      payloadDefinition: {},
      stages: [],
    });

    expect(save).toHaveBeenCalledWith(workflow);

    expect(workflow).toStrictEqual(
      Workflow.createMock({
        _id: expect.any(String),
        code: "wf-001",
        payloadDefinition: {},
        stages: [],
      }),
    );
  });
});
