import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { CaseTaskGroup } from "../models/case-task-group.js";
import { CaseTask } from "../models/case-task.js";
import { Case } from "../models/case.js";
import { Permissions } from "../models/permissions.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { Workflow } from "../models/workflow.js";
import { publishCaseStatusUpdated } from "../publishers/case-event.publisher.js";
import { save } from "../repositories/case.repository.js";
import { createCaseUseCase } from "./create-case.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

vi.mock("../publishers/case-event.publisher.js");
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
    findWorkflowByCodeUseCase.mockResolvedValue(Workflow.createMock());

    const kase = await createCaseUseCase({
      workflowCode: "workflow-code",
      caseRef: "TEST-001",
      payload: {
        createdAt: "2025-01-01T00:00:00.000Z",
        submittedAt: "2025-01-01T00:00:00.000Z",
        identifiers: {},
        answers: {},
      },
    });

    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith("workflow-code");
    expect(publishCaseStatusUpdated).toHaveBeenCalled({
      caseRef: kase.caseRef,
      workflowCode: kase.workflowCode,
      previousStatus: "NEW",
      currentStatus: "IN_PROGRESS",
    });
    expect(save).toHaveBeenCalledWith(kase);

    expect(kase).toStrictEqual(
      new Case({
        _id: expect.any(String),
        caseRef: "TEST-001",
        workflowCode: "workflow-code",
        currentPhase: "phase-1",
        currentStage: "stage-1",
        currentStatus: "NEW",
        dateReceived: "2025-01-01T00:00:00.000Z",
        payload: {
          createdAt: "2025-01-01T00:00:00.000Z",
          submittedAt: "2025-01-01T00:00:00.000Z",
          identifiers: {},
          answers: {},
        },
        phases: [
          new CasePhase({
            code: "phase-1",
            stages: [
              new CaseStage({
                code: "stage-1",
                taskGroups: [
                  new CaseTaskGroup({
                    code: "task-group-1",
                    tasks: [
                      new CaseTask({
                        code: "task-1",
                        status: "pending",
                        commentRef: null,
                        updatedAt: null,
                        updatedBy: null,
                      }),
                    ],
                  }),
                ],
              }),
              new CaseStage({
                code: "stage-2",
                taskGroups: [],
              }),
              new CaseStage({
                code: "stage-3",
                taskGroups: [],
              }),
            ],
          }),
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
        requiredRoles: new Permissions({
          allOf: ["ROLE_1", "ROLE_2"],
          anyOf: ["ROLE_3"],
        }),
      }),
    );
  });
});
