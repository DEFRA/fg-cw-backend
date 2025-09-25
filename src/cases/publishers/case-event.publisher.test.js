import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "../../common/config.js";
import { publish } from "../../common/sns-client.js";
import { withTraceParent } from "../../common/trace-parent.js";
import { publishCaseStatusUpdated } from "./case-event.publisher.js";

vi.mock("../../common/sns-client.js");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-05-28T20:40:48.451Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("publishCaseStatusUpdated", () => {
  it("publishes CaseStatusUpdated to SNS topic", async () => {
    await withTraceParent("1234-0987", async () => {
      await publishCaseStatusUpdated({
        caseRef: "case-456",
        previousStatus: "new",
        currentStatus: "approved",
      });
    });

    expect(publish).toHaveBeenCalledWith(
      config.get("aws.sns.caseStatusUpdatedTopicArn"),
      {
        id: expect.any(String),
        source: "fg-cw-backend",
        specversion: "1.0",
        time: "2025-05-28T20:40:48.451Z",
        type: "cloud.defra.local.fg-cw-backend.case.status.updated",
        traceparent: "1234-0987",
        datacontenttype: "application/json",
        data: {
          caseRef: "case-456",
          previousStatus: "new",
          currentStatus: "approved",
        },
      },
    );
  });
});
