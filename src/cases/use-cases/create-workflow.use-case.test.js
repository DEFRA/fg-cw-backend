import { describe, expect, it, vi } from "vitest";
import { Permissions } from "../models/permissions.js";
import { Position } from "../models/position.js";
import { WorkflowEndpoint } from "../models/workflow-endpoint.js";
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
      endpoints: [WorkflowEndpoint.createMock()],
      externalActions: [
        {
          code: "RECALCULATE_RULES",
          name: "Run calculations again",
          description: "Rerun the business rules validation",
          display: true,
          endpoint: {
            code: "rules-engine-endpoint",
          },
          target: {
            position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
            targetNode: "landGrantsRulesRun",
            dataType: "ARRAY",
            place: "append",
          },
        },
      ],
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
      endpoints: [WorkflowEndpoint.createMock()],
      externalActions: [
        {
          code: "RECALCULATE_RULES",
          name: "Run calculations again",
          description: "Rerun the business rules validation",
          display: true,
          endpoint: {
            code: "rules-engine-endpoint",
          },
          target: {
            position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
            targetNode: "landGrantsRulesRun",
            dataType: "ARRAY",
            place: "append",
          },
        },
      ],
    });

    expect(workflow).toStrictEqual(expectedWorkflow);
  });

  describe("targetPosition resolution", () => {
    const createTestWorkflow = (transitions) =>
      createWorkflowUseCase({
        code: "test-workflow",
        pages: { cases: { details: { banner: {}, tabs: {} } } },
        phases: [
          {
            code: "PHASE_A",
            name: "Phase A",
            stages: [
              {
                code: "STAGE_1",
                name: "Stage 1",
                description: "Stage 1",
                statuses: [
                  {
                    code: "STATUS_A",
                    name: "Status A",
                    description: "Status A",
                    transitions,
                  },
                  {
                    code: "STATUS_B",
                    name: "Status B",
                    description: "Status B",
                    transitions: [],
                  },
                ],
                taskGroups: [],
              },
              {
                code: "STAGE_2",
                name: "Stage 2",
                description: "Stage 2",
                statuses: [
                  {
                    code: "STATUS_C",
                    name: "Status C",
                    description: "Status C",
                    transitions: [],
                  },
                ],
                taskGroups: [],
              },
            ],
          },
          {
            code: "PHASE_B",
            name: "Phase B",
            stages: [
              {
                code: "STAGE_3",
                name: "Stage 3",
                description: "Stage 3",
                statuses: [
                  {
                    code: "STATUS_D",
                    name: "Status D",
                    description: "Status D",
                    transitions: [],
                  },
                ],
                taskGroups: [],
              },
            ],
          },
        ],
        requiredRoles: { allOf: [], anyOf: [] },
        definitions: {},
        externalActions: [],
      });

    it("resolves ::STATUS_CODE to CURRENT_PHASE:CURRENT_STAGE:STATUS_CODE", async () => {
      const workflow = await createTestWorkflow([
        {
          targetPosition: "::STATUS_B",
          action: { code: "NEXT", name: "Next", checkTasks: false },
        },
      ]);

      expect(
        workflow.phases[0].stages[0].statuses[0].transitions[0].targetPosition,
      ).toEqual(
        new Position({
          phaseCode: "PHASE_A",
          stageCode: "STAGE_1",
          statusCode: "STATUS_B",
        }),
      );
    });

    it("resolves :STAGE_CODE: to CURRENT_PHASE:STAGE_CODE:FIRST_STATUS", async () => {
      const workflow = await createTestWorkflow([
        {
          targetPosition: ":STAGE_2:",
          action: { code: "NEXT", name: "Next", checkTasks: false },
        },
      ]);

      expect(
        workflow.phases[0].stages[0].statuses[0].transitions[0].targetPosition,
      ).toEqual(
        new Position({
          phaseCode: "PHASE_A",
          stageCode: "STAGE_2",
          statusCode: "STATUS_C",
        }),
      );
    });

    it("resolves PHASE_CODE:: to PHASE_CODE:FIRST_STAGE:FIRST_STATUS", async () => {
      const workflow = await createTestWorkflow([
        {
          targetPosition: "PHASE_B::",
          action: { code: "NEXT", name: "Next", checkTasks: false },
        },
      ]);

      expect(
        workflow.phases[0].stages[0].statuses[0].transitions[0].targetPosition,
      ).toEqual(
        new Position({
          phaseCode: "PHASE_B",
          stageCode: "STAGE_3",
          statusCode: "STATUS_D",
        }),
      );
    });

    it("resolves :STAGE_CODE:STATUS_CODE to CURRENT_PHASE:STAGE_CODE:STATUS_CODE", async () => {
      const workflow = await createTestWorkflow([
        {
          targetPosition: ":STAGE_2:STATUS_C",
          action: { code: "NEXT", name: "Next", checkTasks: false },
        },
      ]);

      expect(
        workflow.phases[0].stages[0].statuses[0].transitions[0].targetPosition,
      ).toEqual(
        new Position({
          phaseCode: "PHASE_A",
          stageCode: "STAGE_2",
          statusCode: "STATUS_C",
        }),
      );
    });

    it("resolves PHASE_CODE::STATUS_CODE to PHASE_CODE:FIRST_STAGE:STATUS_CODE", async () => {
      const workflow = await createTestWorkflow([
        {
          targetPosition: "PHASE_B::STATUS_D",
          action: { code: "NEXT", name: "Next", checkTasks: false },
        },
      ]);

      expect(
        workflow.phases[0].stages[0].statuses[0].transitions[0].targetPosition,
      ).toEqual(
        new Position({
          phaseCode: "PHASE_B",
          stageCode: "STAGE_3",
          statusCode: "STATUS_D",
        }),
      );
    });

    it("keeps fully qualified position unchanged", async () => {
      const workflow = await createTestWorkflow([
        {
          targetPosition: "PHASE_B:STAGE_3:STATUS_D",
          action: { code: "NEXT", name: "Next", checkTasks: false },
        },
      ]);

      expect(
        workflow.phases[0].stages[0].statuses[0].transitions[0].targetPosition,
      ).toEqual(
        new Position({
          phaseCode: "PHASE_B",
          stageCode: "STAGE_3",
          statusCode: "STATUS_D",
        }),
      );
    });

    it("throws error for invalid position ::", async () => {
      await expect(
        createTestWorkflow([
          {
            targetPosition: "::",
            action: { code: "NEXT", name: "Next", checkTasks: false },
          },
        ]),
      ).rejects.toThrow("Target position '::' is not valid");
    });

    it("throws error for non-existent phase", async () => {
      await expect(
        createTestWorkflow([
          {
            targetPosition: "PHASE_X::",
            action: { code: "NEXT", name: "Next", checkTasks: false },
          },
        ]),
      ).rejects.toThrow("Phase 'PHASE_X' not found in workflow");
    });

    it("throws error for non-existent stage", async () => {
      await expect(
        createTestWorkflow([
          {
            targetPosition: ":STAGE_X:",
            action: { code: "NEXT", name: "Next", checkTasks: false },
          },
        ]),
      ).rejects.toThrow("Stage 'STAGE_X' not found in phase 'PHASE_A'");
    });

    it("throws error for non-existent status", async () => {
      await expect(
        createTestWorkflow([
          {
            targetPosition: "::STATUS_X",
            action: { code: "NEXT", name: "Next", checkTasks: false },
          },
        ]),
      ).rejects.toThrow("Status 'STATUS_X' not found in stage 'STAGE_1'");
    });
  });
});
