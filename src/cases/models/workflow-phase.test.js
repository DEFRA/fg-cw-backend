import { describe, expect, it } from "vitest";
import { WorkflowPhase } from "./workflow-phase.js";
import { WorkflowStage } from "./workflow-stage.js";

describe("WorkflowPhase", () => {
  describe("fromDefinition", () => {
    const stage = (code, statuses = []) => ({
      code,
      name: code,
      description: null,
      statuses,
      taskGroups: [],
    });

    const definition = (stages) => ({
      code: "PRE_AWARD",
      name: "Pre award",
      stages,
    });

    it("builds a phase whose stages are built from their definitions", () => {
      const phase = WorkflowPhase.fromDefinition(
        definition([stage("REVIEW"), stage("DECISION")]),
      );

      expect(phase).toBeInstanceOf(WorkflowPhase);
      expect(phase.stages[1]).toBeInstanceOf(WorkflowStage);
      expect(phase.findStage("DECISION").code).toBe("DECISION");
    });

    it("rejects a stage code used twice", () => {
      expect(() =>
        WorkflowPhase.fromDefinition(
          definition([stage("REVIEW"), stage("REVIEW")]),
        ),
      ).toThrow(
        'Invalid WorkflowPhase "PRE_AWARD": "stages[1]" repeats code "REVIEW"',
      );
    });

    it("rejects a phase with no stages", () => {
      expect(() => WorkflowPhase.fromDefinition(definition(undefined))).toThrow(
        'Invalid WorkflowPhase "PRE_AWARD": "stages" is required',
      );
    });

    it("rejects a stage the phase holds that its own rules reject", () => {
      expect(() =>
        WorkflowPhase.fromDefinition(
          definition([stage("REVIEW", [{ code: "A" }, { code: "A" }])]),
        ),
      ).toThrow('Invalid WorkflowStage "REVIEW"');
    });
  });
});
