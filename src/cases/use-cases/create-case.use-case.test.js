import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/case.repository.js";
import { createCaseUseCase } from "./create-case.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflow-by-code.use-case.js");

describe("createCaseUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a case", async () => {
    findWorkflowByCodeUseCase.mockResolvedValue(
      new Workflow({
        code: "wf-001",
        stages: [
          {
            code: "stage-1",
            taskGroups: [
              {
                id: "task-group-1",
                tasks: [
                  {
                    id: "task-1",
                    type: "task-type-1",
                  },
                ],
              },
            ],
          },
        ],
        requiredRoles: {
          allOf: ["ROLE_1", "ROLE_2"],
          anyOf: ["ROLE_3"],
        },
      }),
    );

    const kase = await createCaseUseCase({
      workflowCode: "wf-001",
      caseRef: "TEST-001",
      payload: {
        createdAt: "2025-01-01T00:00:00.000Z",
        submittedAt: "2025-01-01T00:00:00.000Z",
        identifiers: {},
        answers: {},
      },
    });

    expect(save).toHaveBeenCalledWith(kase);

    const expectedCase = new Case({
      _id: expect.any(String),
      caseRef: "TEST-001",
      workflowCode: "wf-001",
      status: "NEW",
      dateReceived: "2025-01-01T00:00:00.000Z",
      payload: {
        createdAt: "2025-01-01T00:00:00.000Z",
        submittedAt: "2025-01-01T00:00:00.000Z",
        identifiers: {},
        answers: {},
      },
      currentStage: "stage-1",
      stages: [
        {
          code: "stage-1",
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
      timeline: [
        TimelineEvent.create({
          eventType: "CASE_CREATED",
          createdAt: "2025-01-01T00:00:00.000Z",
          description: "Case received",
          createdBy: "System",
          data: {
            caseRef: "TEST-001",
          },
        }),
      ],
      comments: [],
      assignedUser: null,
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    });

    expect(kase).toEqual(expectedCase);
  });
});
