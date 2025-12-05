import { describe, expect, it } from "vitest";
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
});
