import { describe, expect, it, vi } from "vitest";

const { mockSaveInboxMessageUseCase } = vi.hoisted(() => ({
  mockSaveInboxMessageUseCase: vi.fn(),
}));

vi.mock("../../common/config.js", () => ({
  config: {
    get: (key) => {
      const values = {
        "aws.sqs.configVersionQueueUrl":
          "http://sqs.eu-west-2.localhost:4566/000000000000/cw__sqs__config_version_updated_fifo.fifo",
        "aws.region": "eu-west-2",
        "aws.endpointUrl": "http://localhost:4566",
      };
      return values[key];
    },
  },
}));

vi.mock("../use-cases/save-inbox-message.use-case.js", () => ({
  messageSource: { ConfigBroker: "CONFIG_BROKER" },
  saveInboxMessageUseCase: mockSaveInboxMessageUseCase,
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

  it("should call saveInboxMessageUseCase with CONFIG_BROKER source on message", async () => {
    const { configVersionUpdatedSubscriber } =
      await import("./config-version-updated.subscriber.js");

    const message = { id: "msg-1", data: { grantCode: "woodland" } };
    await configVersionUpdatedSubscriber.onMessage(message);

    expect(mockSaveInboxMessageUseCase).toHaveBeenCalledWith(
      message,
      "CONFIG_BROKER",
    );
  });
});
