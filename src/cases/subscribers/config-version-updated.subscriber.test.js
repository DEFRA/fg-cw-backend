import { describe, expect, it, vi } from "vitest";

const { mockProcessConfigVersion } = vi.hoisted(() => ({
  mockProcessConfigVersion: vi.fn(),
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

vi.mock("../../common/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../use-cases/process-config-version.use-case.js", () => ({
  processConfigVersionUseCase: mockProcessConfigVersion,
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

  it("should extract message attributes and call processConfigVersionUseCase", async () => {
    const { configVersionUpdatedSubscriber } =
      await import("./config-version-updated.subscriber.js");

    const body = ["example-grant/1.0.0/metadata.json"];
    const messageAttributes = {
      grant: { DataType: "String", StringValue: "woodland" },
      version: { DataType: "String", StringValue: "1.2.3" },
      status: { DataType: "String", StringValue: "active" },
    };

    await configVersionUpdatedSubscriber.onMessage(body, messageAttributes);

    expect(mockProcessConfigVersion).toHaveBeenCalledWith({
      grantCode: "woodland",
      version: "1.2.3",
      status: "active",
    });
  });
});
