import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { WorkflowTask } from "../models/workflow-task.js";
import { Workflow } from "../models/workflow.js";
import { save } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";
import { newCaseUseCase } from "./new-case.use-case.js";

vi.mock("../repositories/outbox.repository.js");
vi.mock("../repositories/case.repository.js");
vi.mock("./find-workflow-by-code.use-case.js");

describe("newCaseUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a case", async () => {
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });
    findWorkflowByCodeUseCase.mockResolvedValue(Workflow.createMock());

    await newCaseUseCase(
      {
        event: {
          data: {
            workflowCode: "workflow-code",
            caseRef: "TEST-001",
            payload: {
              createdAt: "2025-01-01T00:00:00.000Z",
              submittedAt: "2025-01-01T00:00:00.000Z",
              identifiers: {},
              answers: {},
            },
          },
        },
      },
      {},
    );

    const savedCase = save.mock.calls[0][0];
    expect(savedCase).toBeInstanceOf(Case);
    expect(savedCase.phases).toHaveLength(1);
    expect(savedCase.phases[0].code).toBe("PHASE_1");
    expect(savedCase.phases[0].stages).toHaveLength(1);
    expect(savedCase.phases[0].stages[0].code).toBe("STAGE_1");
  });

  it("maps temporary caveat sources from code before saving the case", async () => {
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });
    findWorkflowByCodeUseCase.mockResolvedValue(Workflow.createMock());

    await newCaseUseCase(
      {
        event: {
          data: {
            workflowCode: "workflow-code",
            caseRef: "TEST-001A",
            payload: {
              answers: {
                rulesCalculations: {
                  caveats: [
                    { code: "hefer-consent-required" },
                    { code: "ne-consent-required" },
                    { code: "other-code", source: "existing-source" },
                  ],
                },
              },
            },
          },
        },
      },
      {},
    );

    expect(
      save.mock.calls[0][0].payload.answers.rulesCalculations.caveats,
    ).toEqual([
      {
        code: "hefer-consent-required",
        source: "historic-england",
      },
      {
        code: "ne-consent-required",
        source: "natural-england",
      },
      {
        code: "other-code",
        source: "existing-source",
      },
    ]);
  });

  it("excludes conditional tasks when condition is not met", async () => {
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });

    const mockWorkflow = Workflow.createMock();
    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks.push(
      new WorkflowTask({
        conditional:
          "$.payload.answers[?(@property == 'whitePigsCount' && @ > 3)]",
        code: "CONDITIONAL_TASK",
        name: "Conditional Task",
        mandatory: true,
        description: "Only when whitePigsCount > 3",
        statusOptions: [
          {
            code: "ACCEPTED",
            name: "Accept",
            theme: "NONE",
            completes: true,
          },
        ],
      }),
    );

    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await newCaseUseCase(
      {
        event: {
          data: {
            workflowCode: "workflow-code",
            caseRef: "TEST-002",
            payload: {
              answers: { whitePigsCount: 2 },
            },
          },
        },
      },
      {},
    );

    const savedCase = save.mock.calls[0][0];
    const taskCodes = savedCase.phases[0].stages[0].taskGroups[0].tasks.map(
      (t) => t.code,
    );
    expect(taskCodes).toContain("TASK_1");
    expect(taskCodes).not.toContain("CONDITIONAL_TASK");
  });

  it("includes conditional tasks when condition is met", async () => {
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });

    const mockWorkflow = Workflow.createMock();
    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks.push(
      new WorkflowTask({
        conditional:
          "$.payload.answers[?(@property == 'whitePigsCount' && @ > 3)]",
        code: "CONDITIONAL_TASK",
        name: "Conditional Task",
        mandatory: true,
        description: "Only when whitePigsCount > 3",
        statusOptions: [
          {
            code: "ACCEPTED",
            name: "Accept",
            theme: "NONE",
            completes: true,
          },
        ],
      }),
    );

    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await newCaseUseCase(
      {
        event: {
          data: {
            workflowCode: "workflow-code",
            caseRef: "TEST-003",
            payload: {
              answers: { whitePigsCount: 5 },
            },
          },
        },
      },
      {},
    );

    const savedCase = save.mock.calls[0][0];
    const taskCodes = savedCase.phases[0].stages[0].taskGroups[0].tasks.map(
      (t) => t.code,
    );
    expect(taskCodes).toContain("TASK_1");
    expect(taskCodes).toContain("CONDITIONAL_TASK");
  });

  it("excludes conditional task at boundary value whitePigsCount = 3", async () => {
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });

    const mockWorkflow = Workflow.createMock();
    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks.push(
      new WorkflowTask({
        conditional:
          "$.payload.answers[?(@property == 'whitePigsCount' && @ > 3)]",
        code: "CONDITIONAL_TASK",
        name: "Conditional Task",
        mandatory: true,
        description: "Only when whitePigsCount > 3",
        statusOptions: [
          {
            code: "ACCEPTED",
            name: "Accept",
            theme: "NONE",
            completes: true,
          },
        ],
      }),
    );

    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await newCaseUseCase(
      {
        event: {
          data: {
            workflowCode: "workflow-code",
            caseRef: "TEST-004",
            payload: {
              answers: { whitePigsCount: 3 },
            },
          },
        },
      },
      {},
    );

    const savedCase = save.mock.calls[0][0];
    const taskCodes = savedCase.phases[0].stages[0].taskGroups[0].tasks.map(
      (t) => t.code,
    );
    expect(taskCodes).toContain("TASK_1");
    expect(taskCodes).not.toContain("CONDITIONAL_TASK");
  });

  it("includes conditional task at boundary value whitePigsCount = 4", async () => {
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });

    const mockWorkflow = Workflow.createMock();
    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks.push(
      new WorkflowTask({
        conditional:
          "$.payload.answers[?(@property == 'whitePigsCount' && @ > 3)]",
        code: "CONDITIONAL_TASK",
        name: "Conditional Task",
        mandatory: true,
        description: "Only when whitePigsCount > 3",
        statusOptions: [
          {
            code: "ACCEPTED",
            name: "Accept",
            theme: "NONE",
            completes: true,
          },
        ],
      }),
    );

    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await newCaseUseCase(
      {
        event: {
          data: {
            workflowCode: "workflow-code",
            caseRef: "TEST-005",
            payload: {
              answers: { whitePigsCount: 4 },
            },
          },
        },
      },
      {},
    );

    const savedCase = save.mock.calls[0][0];
    const taskCodes = savedCase.phases[0].stages[0].taskGroups[0].tasks.map(
      (t) => t.code,
    );
    expect(taskCodes).toContain("TASK_1");
    expect(taskCodes).toContain("CONDITIONAL_TASK");
  });

  it("excludes conditional task when whitePigsCount is absent from payload.answers", async () => {
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });

    const mockWorkflow = Workflow.createMock();
    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks.push(
      new WorkflowTask({
        conditional:
          "$.payload.answers[?(@property == 'whitePigsCount' && @ > 3)]",
        code: "CONDITIONAL_TASK",
        name: "Conditional Task",
        mandatory: true,
        description: "Only when whitePigsCount > 3",
        statusOptions: [
          {
            code: "ACCEPTED",
            name: "Accept",
            theme: "NONE",
            completes: true,
          },
        ],
      }),
    );

    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await newCaseUseCase(
      {
        event: {
          data: {
            workflowCode: "workflow-code",
            caseRef: "TEST-006",
            payload: {
              answers: { otherField: "value" },
            },
          },
        },
      },
      {},
    );

    const savedCase = save.mock.calls[0][0];
    const taskCodes = savedCase.phases[0].stages[0].taskGroups[0].tasks.map(
      (t) => t.code,
    );
    expect(taskCodes).toContain("TASK_1");
    expect(taskCodes).not.toContain("CONDITIONAL_TASK");
  });

  it("excludes conditional task when payload.answers is missing entirely", async () => {
    save.mockResolvedValue({
      insertedId: new ObjectId("888888888888888999999998"),
    });

    const mockWorkflow = Workflow.createMock();
    mockWorkflow.phases[0].stages[0].taskGroups[0].tasks.push(
      new WorkflowTask({
        conditional:
          "$.payload.answers[?(@property == 'whitePigsCount' && @ > 3)]",
        code: "CONDITIONAL_TASK",
        name: "Conditional Task",
        mandatory: true,
        description: "Only when whitePigsCount > 3",
        statusOptions: [
          {
            code: "ACCEPTED",
            name: "Accept",
            theme: "NONE",
            completes: true,
          },
        ],
      }),
    );

    findWorkflowByCodeUseCase.mockResolvedValue(mockWorkflow);

    await newCaseUseCase(
      {
        event: {
          data: {
            workflowCode: "workflow-code",
            caseRef: "TEST-007",
            payload: {},
          },
        },
      },
      {},
    );

    const savedCase = save.mock.calls[0][0];
    const taskCodes = savedCase.phases[0].stages[0].taskGroups[0].tasks.map(
      (t) => t.code,
    );
    expect(taskCodes).toContain("TASK_1");
    expect(taskCodes).not.toContain("CONDITIONAL_TASK");
  });
});
