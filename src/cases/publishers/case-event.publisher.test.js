import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { publish } from "../../common/sns-client.js";
import { withTraceParent } from "../../common/trace-parent.js";
import { publishCaseStageUpdated } from "./case-event.publisher.js";

vi.mock("../../common/sns-client.js");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-05-28T20:40:48.451Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("publishCaseStageUpdated", () => {
  it("publishes CaseStageUpdated to SNS topic", async () => {
    await withTraceParent("1234-0987", async () => {
      await publishCaseStageUpdated({
        caseRef: "case-123",
        previousStage: "draft",
        currentStage: "submitted",
      });
    });

    expect(publish).toHaveBeenCalledWith(
      config.get("aws.caseStageUpdatedTopicArn"),
      {
        id: expect.any(String),
        source: "fg-cw-backend",
        specversion: "1.0",
        time: "2025-05-28T20:40:48.451Z",
        type: "cloud.defra.local.fg-cw-backend.case.stage.updated",
        traceparent: "1234-0987",
        datacontenttype: "application/json",
        data: {
          caseRef: "case-123",
          previousStage: "draft",
          currentStage: "submitted",
        },
      },
    );
  });
});
