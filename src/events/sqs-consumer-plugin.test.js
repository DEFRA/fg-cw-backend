import { describe, it, expect, vi, beforeEach } from "vitest";
import sqsConsumerPlugin from "./sqs-consumer-plugin.js";
import SqsConsumer from "./sqs-consumer.js";

// Mock SqsConsumer class
vi.mock("./sqs-consumer.js", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockResolvedValue(),
      stop: vi.fn().mockResolvedValue()
    }))
  };
});

describe("sqsConsumerPlugin", () => {
  let server;
  let options;

  beforeEach(() => {
    vi.clearAllMocks();

    server = {
      app: {},
      ext: vi.fn()
    };

    // Create mock options
    options = {
      queueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/test-queue",
      handleMessage: vi.fn()
    };
  });

  it("should have the correct name", () => {
    expect(sqsConsumerPlugin.name).toBe("sqs-consumer");
  });

  describe("register", () => {
    it("should create a new SQS consumer with server and options", async () => {
      await sqsConsumerPlugin.register(server, options);

      expect(SqsConsumer).toHaveBeenCalledWith(server, {
        queueUrl: options.queueUrl,
        handleMessage: options.handleMessage
      });
    });

    it("should register the consumer in server.app", async () => {
      await sqsConsumerPlugin.register(server, options);

      expect(server.app.sqsConsumer).toBeDefined();
    });
  });
});
