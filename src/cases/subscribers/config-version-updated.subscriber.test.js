import { describe, expect, it, vi } from "vitest";

const { mockSaveConfigVersion } = vi.hoisted(() => ({
  mockSaveConfigVersion: vi.fn(),
}));

vi.mock("../../common/config.js", () => ({
  config: {
    get: (key) => {
      const values = {
        "aws.sqs.configVersionQueueUrl":
          "http://sqs.eu-west-2.localhost:4566/000000000000/cw__sqs__config_version_updated",
        "aws.region": "eu-west-2",
        "aws.endpointUrl": "http://localhost:4566",
      };
      return values[key];
    },
  },
}));

vi.mock("../use-cases/save-config-version-inbox-message.use-case.js", () => ({
  saveConfigVersionInboxMessageUseCase: mockSaveConfigVersion,
}));

vi.mock("../../common/sqs-subscriber.js", () => ({
  SqsSubscriber: class MockSqsSubscriber {
    constructor(opts) {
      this.queueUrl = opts.queueUrl;
      this.onMessage = opts.onMessage;
    }

    start() {}
    stop() {}
  },
}));

describe("configVersionUpdatedSubscriber", () => {
  it("should be an instance of SqsSubscriber when queue URL is configured", async () => {
    const { configVersionUpdatedSubscriber } =
      await import("./config-version-updated.subscriber.js");
    expect(configVersionUpdatedSubscriber).not.toBeNull();
  });

  it("only saves the message to the inbox", async () => {
    const { configVersionUpdatedSubscriber } =
      await import("./config-version-updated.subscriber.js");

    const body = ["woodland/1.2.3/cw/cw.json", "woodland/1.2.3/metadata.json"];
    const messageAttributes = {
      grant: { DataType: "String", StringValue: "woodland" },
      version: { DataType: "String", StringValue: "1.2.3" },
      status: { DataType: "String", StringValue: "active" },
      path: { DataType: "String", StringValue: "config-broker-local" },
    };
    const metadata = { messageId: "msg-1", sentTimestamp: "1758106800000" };

    await configVersionUpdatedSubscriber.onMessage(
      body,
      messageAttributes,
      metadata,
    );

    expect(mockSaveConfigVersion).toHaveBeenCalledWith(
      body,
      messageAttributes,
      metadata,
    );
  });
});
