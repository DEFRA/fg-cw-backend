import { describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/case.repository.js";
import { createCaseUseCase } from "./create-case.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflow-by-code.use-case.js");

describe("createCaseUseCase", () => {
  it("creates a case", async () => {
    findWorkflowByCodeUseCase.mockResolvedValue(
      new Workflow({
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
      }),
    );

    const kase = await createCaseUseCase({
      code: "wf-001",
      clientRef: "TEST-001",
      createdAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      identifiers: {},
      answers: {},
    });

    expect(save).toHaveBeenCalledWith(kase);

    expect(kase).toStrictEqual(
      new Case({
        _id: expect.any(String),
        caseRef: "TEST-001",
        workflowCode: "wf-001",
        status: "NEW",
        dateReceived: expect.any(String),
        payload: {
          clientRef: "TEST-001",
          code: "wf-001",
          createdAt: expect.any(String),
          submittedAt: expect.any(String),
          identifiers: {},
          answers: {},
        },
        currentStage: "stage-1",
        stages: [
          {
            id: "stage-1",
            taskGroups: [
              {
                id: "task-group-1",
                tasks: [
                  {
                    id: "task-1",
                    status: "pending",
                  },
                ],
              },
            ],
          },
        ],
        assignedUser: null,
      }),
    );
  });
});
