import { describe, expect, it } from "vitest";
import { WorkflowStageStatus } from "./workflow-stage-status.js";
import { WorkflowStage } from "./workflow-stage.js";
import { WorkflowTaskGroup } from "./workflow-task-group.js";

describe("WorkflowStage", () => {
  describe("fromDefinition", () => {
    const status = (code, transitions = []) => ({
      code,
      name: code,
      theme: "INFO",
      description: null,
      interactive: true,
      transitions,
    });

    const taskGroup = (code) => ({
      code,
      name: code,
      description: null,
      tasks: [
        {
          code: "CHECK",
          name: "Check",
          mandatory: true,
          description: null,
          valueOptions: [
            { code: "DONE", name: "Done", theme: "SUCCESS", completes: true },
          ],
        },
      ],
    });

    const definition = (overrides = {}) => ({
      code: "REVIEW",
      name: "Review",
      description: null,
      statuses: [status("RECEIVED"), status("APPROVED")],
      taskGroups: [taskGroup("CHECKS"), taskGroup("APPROVALS")],
      ...overrides,
    });

    it("builds a stage whose statuses and task groups are built from their definitions", () => {
      const stage = WorkflowStage.fromDefinition(definition());

      expect(stage).toBeInstanceOf(WorkflowStage);
      expect(stage.statuses[0]).toBeInstanceOf(WorkflowStageStatus);
      expect(stage.taskGroups[0]).toBeInstanceOf(WorkflowTaskGroup);
    });

    it.each([
      [
        "a status code",
        { statuses: [status("RECEIVED"), status("RECEIVED")] },
        '"statuses[1]" repeats code "RECEIVED"',
      ],
      [
        "a task group code",
        { taskGroups: [taskGroup("CHECKS"), taskGroup("CHECKS")] },
        '"taskGroups[1]" repeats code "CHECKS"',
      ],
    ])("rejects %s used twice", (_, overrides, reason) => {
      expect(() => WorkflowStage.fromDefinition(definition(overrides))).toThrow(
        `Invalid WorkflowStage "REVIEW": ${reason}`,
      );
    });

    it.each([
      ["statuses", { statuses: undefined }],
      ["task groups", { taskGroups: undefined }],
    ])("rejects a stage with no %s", (_, overrides) => {
      expect(() => WorkflowStage.fromDefinition(definition(overrides))).toThrow(
        'Invalid WorkflowStage "REVIEW"',
      );
    });

    it("rejects a status the stage holds that its own rules reject", () => {
      expect(() =>
        WorkflowStage.fromDefinition(
          definition({
            statuses: [{ ...status("RECEIVED"), transitions: undefined }],
          }),
        ),
      ).toThrow('Invalid WorkflowStageStatus "RECEIVED"');
    });
  });
});
