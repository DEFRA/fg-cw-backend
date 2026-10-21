import { describe, expect, it } from "vitest";
import { Position } from "./position.js";
import { WorkflowStageStatus } from "./workflow-stage-status.js";

describe("WorkflowStageStatus", () => {
  it("should assign theme property", () => {
    const status = new WorkflowStageStatus({
      code: "IN_REVIEW",
      name: "In Review",
      theme: "INFO",
      description: "Test description",
      interactive: true,
      transitions: [],
    });

    expect(status.theme).toBe("INFO");
  });

  it("should allow all valid theme values", () => {
    const themes = ["NEUTRAL", "INFO", "NOTICE", "ERROR", "WARN", "SUCCESS"];

    themes.forEach((theme) => {
      const status = new WorkflowStageStatus({
        code: "TEST",
        name: "Test",
        theme,
        description: "Test",
        interactive: true,
        transitions: [],
      });
      expect(status.theme).toBe(theme);
    });
  });

  describe("fromDefinition", () => {
    const transition = (targetPosition, actionCode) => ({
      targetPosition,
      checkTasks: false,
      action: actionCode
        ? {
            code: actionCode,
            name: actionCode,
            checkTasks: false,
            comment: null,
          }
        : null,
    });

    const definition = (transitions) => ({
      code: "IN_REVIEW",
      name: "In review",
      theme: "INFO",
      description: null,
      interactive: true,
      transitions,
    });

    it("builds a status whose transitions target positions", () => {
      const status = WorkflowStageStatus.fromDefinition(
        definition([
          transition("PRE_AWARD:REVIEW:APPROVED", "APPROVE"),
          transition("PRE_AWARD:REVIEW:REJECTED", "REJECT"),
          transition("PRE_AWARD:REVIEW:WITHDRAWN"),
          transition("PRE_AWARD:REVIEW:ON_HOLD"),
        ]),
      );

      expect(status).toBeInstanceOf(WorkflowStageStatus);
      expect(status.transitions[0].targetPosition).toEqual(
        Position.from("PRE_AWARD:REVIEW:APPROVED"),
      );
      expect(status.getActions().map(({ code }) => code)).toEqual([
        "APPROVE",
        "REJECT",
      ]);
    });

    it("rejects an action code used twice", () => {
      expect(() =>
        WorkflowStageStatus.fromDefinition(
          definition([
            transition("PRE_AWARD:REVIEW:APPROVED", "APPROVE"),
            transition("PRE_AWARD:REVIEW:REJECTED", "APPROVE"),
          ]),
        ),
      ).toThrow(
        'Invalid WorkflowStageStatus "IN_REVIEW": "transitions[1]" repeats action code "APPROVE"',
      );
    });

    it.each([
      ["no code", undefined, '"transitions[0].action.code" is required'],
      [
        "an empty code",
        "",
        '"transitions[0].action.code" is not allowed to be empty',
      ],
      [
        "a code that is not a string",
        1,
        '"transitions[0].action.code" must be a string',
      ],
    ])("rejects an action with %s", (_, code, reason) => {
      const action = transition("PRE_AWARD:REVIEW:APPROVED", "APPROVE");
      action.action.code = code;

      expect(() =>
        WorkflowStageStatus.fromDefinition(definition([action])),
      ).toThrow(`Invalid WorkflowStageStatus "IN_REVIEW": ${reason}`);
    });

    it("rejects a status with no transitions", () => {
      expect(() =>
        WorkflowStageStatus.fromDefinition(definition(undefined)),
      ).toThrow(
        'Invalid WorkflowStageStatus "IN_REVIEW": "transitions" is required',
      );
    });

    it("rejects a malformed target position", () => {
      expect(() =>
        WorkflowStageStatus.fromDefinition(
          definition([transition("not a position")]),
        ),
      ).toThrow("Position not a position does not match format");
    });
  });
});
