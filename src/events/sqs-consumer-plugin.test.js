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

    // Mock Hapi server instance
    server = {
      app: {},
      events: {
        on: vi.fn()
      }
    };

    // Mock plugin options
    options = {
      queueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/test-queue",
      handleMessage: vi.fn()
    };
  });

  it("should contain the correct plugin name", () => {
    expect(sqsConsumerPlugin.name).toBe("sqs-consumer");
  });

  describe("register function", () => {
    it("should create an SQS consumer with the provided server and options", async () => {
      await sqsConsumerPlugin.register(server, options);

      expect(SqsConsumer).toHaveBeenCalledWith(server, {
        queueUrl: options.queueUrl,
        handleMessage: options.handleMessage
      });
    });

    it("should attach event listeners for start and stop events", async () => {
      const consumerMock = {
        start: vi.fn(),
        stop: vi.fn()
      };
      SqsConsumer.mockImplementation(() => consumerMock);

      await sqsConsumerPlugin.register(server, options);

      expect(server.events.on).toHaveBeenCalledWith(
        "start",
        expect.any(Function)
      );
      expect(server.events.on).toHaveBeenCalledWith(
        "stop",
        expect.any(Function)
      );

      // Simulate the event listeners
      const [startEvent, startHandler] = server.events.on.mock.calls[0];
      const [stopEvent, stopHandler] = server.events.on.mock.calls[1];

      expect(startEvent).toBe("start");
      expect(stopEvent).toBe("stop");

      await startHandler();
      expect(consumerMock.start).toHaveBeenCalledTimes(1);

      await stopHandler();
      expect(consumerMock.stop).toHaveBeenCalledTimes(1);
    });

    it("should ensure the consumer starts and stops without errors during events", async () => {
      const consumerMock = {
        start: vi.fn().mockResolvedValue(),
        stop: vi.fn().mockResolvedValue()
      };
      SqsConsumer.mockImplementation(() => consumerMock);

      await sqsConsumerPlugin.register(server, options);

      // Simulate start and stop
      const startHandler = server.events.on.mock.calls[0][1];
      const stopHandler = server.events.on.mock.calls[1][1];

      await expect(startHandler()).resolves.toBeUndefined();
      await expect(stopHandler()).resolves.toBeUndefined();

      expect(consumerMock.start).toHaveBeenCalledOnce();
      expect(consumerMock.stop).toHaveBeenCalledOnce();
    });

    it("should log or handle errors if start or stop fails", async () => {
      const errorMessage = "Consumer failed";
      const consumerMock = {
        start: vi.fn().mockRejectedValue(new Error(errorMessage)),
        stop: vi.fn().mockRejectedValue(new Error(errorMessage))
      };
      SqsConsumer.mockImplementation(() => consumerMock);

      await sqsConsumerPlugin.register(server, options);

      // Simulate start and stop
      const startHandler = server.events.on.mock.calls[0][1];
      const stopHandler = server.events.on.mock.calls[1][1];

      await expect(startHandler()).rejects.toThrow(errorMessage);
      await expect(stopHandler()).rejects.toThrow(errorMessage);

      expect(consumerMock.start).toHaveBeenCalledOnce();
      expect(consumerMock.stop).toHaveBeenCalledOnce();
    });
  });
});
