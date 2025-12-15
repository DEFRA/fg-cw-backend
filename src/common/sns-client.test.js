import { PublishCommand } from "@aws-sdk/client-sns";
import { beforeEach, describe, expect, it, vi } from "vitest";

let send;

vi.mock("@aws-sdk/client-sns", () => {
  const SNSClient = vi.fn(function SNSClientMock() {
    return { send };
  });

  const PublishCommand = vi.fn(function PublishCommandMock(params) {
    return params;
  });

  return { SNSClient, PublishCommand };
});

describe("publish", () => {
  beforeEach(() => {
    vi.resetModules();
    send = vi.fn();
  });

  it("publishes a message to a topic", async () => {
    const topicArn = "arn:aws:sns:us-east-1:123456789012:MyTopic";

    const message = {
      key: "value",
    };

    const { publish } = await import("./sns-client.js");

    await publish(topicArn, message);

    expect(PublishCommand).toHaveBeenCalledWith({
      TopicArn: topicArn,
      Message: '{"key":"value"}',
    });

    expect(send).toHaveBeenCalledWith({
      TopicArn: topicArn,
      Message: '{"key":"value"}',
    });
  });
});
