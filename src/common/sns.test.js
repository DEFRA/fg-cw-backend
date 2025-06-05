import { describe, expect, it, vi } from "vitest";
import * as sns from "./sns.js";

describe("sns", () => {
  it("publishes an event", async () => {
    const snsSendSpy = vi
      .spyOn(sns.snsClient, "send")
      .mockImplementation(() => {});
    const topicArn = "some-topic-id";
    const event = {
      body: { key: "value " },
    };

    await sns.publish(topicArn, event);
    expect(snsSendSpy).toHaveBeenCalledOnce();
  });
});
