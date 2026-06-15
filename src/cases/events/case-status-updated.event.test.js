import { describe, expect, it, vi } from "vitest";

vi.mock("../../common/config.js", () => ({
  config: {
    get: vi.fn((key) => {
      if (key === "serviceName") {
        return "fg-cw-backend";
      }
      if (key === "cdpEnvironment") {
        return "test";
      }
      return null;
    }),
  },
}));

// eslint-disable-next-line import-x/first
import { CaseStatusUpdatedEvent } from "./case-status-updated.event.js";

describe("CaseStatusUpdatedEvent", () => {
  it("omits configVersion from data when not provided", () => {
    const event = new CaseStatusUpdatedEvent({
      caseRef: "CASE-REF-001",
      workflowCode: "frps-private-beta",
      previousStatus: "DEFAULT:APPLICATION_RECEIPT:AWAITING_REVIEW",
      currentStatus: "DEFAULT:CONTRACT:AWAITING_AGREEMENT",
    });

    expect(event.data).toEqual({
      caseRef: "CASE-REF-001",
      workflowCode: "frps-private-beta",
      previousStatus: "DEFAULT:APPLICATION_RECEIPT:AWAITING_REVIEW",
      currentStatus: "DEFAULT:CONTRACT:AWAITING_AGREEMENT",
    });
    expect(event.messageGroupId).toBe("CASE-REF-001-frps-private-beta");
  });

  it("includes configVersion in data when provided", () => {
    const event = new CaseStatusUpdatedEvent({
      caseRef: "CASE-REF-001",
      workflowCode: "frps-private-beta",
      previousStatus: "DEFAULT:APPLICATION_RECEIPT:AWAITING_REVIEW",
      currentStatus: "DEFAULT:CONTRACT:AWAITING_AGREEMENT",
      configVersion: "1.0.3",
    });

    expect(event.data.configVersion).toBe("1.0.3");
  });
});
