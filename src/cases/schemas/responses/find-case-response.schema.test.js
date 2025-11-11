import { describe, expect, it } from "vitest";
import {
  agreementSchema,
  CaseStage,
  findCaseResponseSchema,
} from "./find-case-response.schema.js";

describe("find case response schema", () => {
  it("should validate agreementSchema", () => {
    const agreement = {
      agreementRef: "agreement-123",
      agreementStatus: "OFFERED",
      createdAt: new Date().toISOString(),
    };

    const { error } = agreementSchema.validate(agreement);
    expect(error).toBeUndefined();
  });

  it("validates a case", () => {
    const kase = {
      _id: "68d52277f04c2eeb6c260923",
      caseRef: "case-ref",
      workflowCode: "workflow-code",
      dateReceived: "2025-01-01T00:00:00.000Z",
      currentPhase: "phase-1",
      currentStage: "stage-1",
      currentStatus: "NEW",
      assignedUser: null,
      payload: {},
      phases: [
        {
          code: "some",
          name: "other",
          stages: [
            {
              code: "stage-1",
              name: "Stage 1",
              description: "Stage 1 description",
              taskGroups: [],
            },
            {
              code: "stage-2",
              name: "Stage 2",
              description: "Stage 2 description",
              taskGroups: [],
            },
          ],
        },
      ],
      comments: [],
      timeline: [[]],
      requiredRoles: { allOf: [], anyOf: [] },
      tasks: {},
      supplementaryData: { agreements: [] },
      banner: { title: {}, summary: {} },
      links: [{}, {}, {}, {}],
    };

    const { error } = findCaseResponseSchema.validate(kase);
    expect(error).toBeUndefined();
  });

  describe("CaseStage task schema validation", () => {
    it("validates task with name, description array, and statusOptions", () => {
      const validStage = {
        code: "stage-1",
        name: "Application Receipt",
        description: "Stage description",
        taskGroups: [
          {
            code: "task-group-1",
            name: "Task Group",
            description: "Task group description",
            tasks: [
              {
                code: "task-1",
                name: "Review Application",
                description: [
                  { component: "heading", level: 2, text: "Review" },
                ],
                statusOptions: [
                  { code: "approved", name: "Approved", completes: true },
                ],
                status: "pending",
                completed: false,
                commentRef: null,
              },
            ],
          },
        ],
        outcome: null,
      };

      const { error } = CaseStage.validate(validStage);
      expect(error).toBeUndefined();
    });

    it("rejects task missing name field", () => {
      const invalidStage = {
        code: "stage-1",
        name: "Application Receipt",
        description: "Stage description",
        taskGroups: [
          {
            code: "task-group-1",
            name: "Task Group",
            description: "Task group description",
            tasks: [
              {
                code: "task-1",
                description: [
                  { component: "heading", level: 2, text: "Review" },
                ],
                statusOptions: [],
                status: "pending",
              },
            ],
          },
        ],
      };

      const { error } = CaseStage.validate(invalidStage);
      expect(error).toBeDefined();
      expect(error.message).toContain("name");
    });

    it("rejects task missing description field", () => {
      const invalidStage = {
        code: "stage-1",
        name: "Application Receipt",
        description: "Stage description",
        taskGroups: [
          {
            code: "task-group-1",
            name: "Task Group",
            description: "Task group description",
            tasks: [
              {
                name: "Task 1",
                code: "task-1",
                statusOptions: [],
                status: "pending",
              },
            ],
          },
        ],
      };

      const { error } = CaseStage.validate(invalidStage);
      expect(error).toBeDefined();
      expect(error.message).toContain("description");
    });

    it("rejects task missing statusOptions field", () => {
      const invalidStage = {
        code: "stage-1",
        name: "Application Receipt",
        description: "Stage description",
        taskGroups: [
          {
            code: "task-group-1",
            name: "Task Group",
            description: "Task group description",
            tasks: [
              {
                code: "task-1",
                name: "Review Application",
                description: [
                  { component: "heading", level: 2, text: "Review" },
                ],
                status: "pending",
              },
            ],
          },
        ],
      };

      const { error } = CaseStage.validate(invalidStage);
      expect(error).toBeDefined();
      expect(error.message).toContain("statusOptions");
    });

    it("rejects task missing completed field", () => {
      const invalidStage = {
        code: "stage-1",
        name: "Application Receipt",
        description: "Stage description",
        taskGroups: [
          {
            code: "task-group-1",
            name: "Task Group",
            description: "Task group description",
            tasks: [
              {
                code: "task-1",
                name: "Review Application",
                description: [
                  { component: "heading", level: 2, text: "Review" },
                ],
                statusOptions: [
                  { code: "approved", name: "Approved", completes: true },
                ],
                status: "pending",
                commentRef: null,
              },
            ],
          },
        ],
        outcome: null,
      };

      const { error } = CaseStage.validate(invalidStage);
      expect(error).toBeDefined();
      expect(error.message).toContain("completed");
    });
  });
});
