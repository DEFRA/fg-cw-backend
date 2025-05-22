import { describe, test, expect, vi } from "vitest";
import * as sns from "./sns";

describe("sns", () => {
  test("publishes an event", async () => {
    const snsSendSpy = vi
      .spyOn(sns.snsClient, "send")
      .mockImplementation(() => {});
    const topicArn = "some-topic-id";
    const event = {
      body: { key: "value " }
    };

    await sns.publish(topicArn, event);
    expect(snsSendSpy).toHaveBeenCalledOnce();
  });
});
