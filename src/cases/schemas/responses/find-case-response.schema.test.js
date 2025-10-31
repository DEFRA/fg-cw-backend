import { describe, expect, it } from "vitest";
import {
  agreementSchema,
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
});
