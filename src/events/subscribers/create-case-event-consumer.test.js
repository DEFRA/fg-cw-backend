import { describe, it, expect, vi } from "vitest";
import { createCaseEventConsumer } from "./create-case-event-consumer.js";
import sqsConsumerPlugin from "./sqs-consumer-plugin.js";
import { createCaseEventHandler } from "../handlers/create-case-event-handler.js";

// Mock the dependencies
vi.mock(".sqs-consumer-plugin.js", () => ({
  default: { name: "sqs-consumer" }
}));

vi.mock("../handlers/create-case-event-handler.js", () => ({
  createCaseEventHandler: vi.fn().mockReturnValue(() => {})
}));

describe("createCaseEventConsumer", () => {
  const mockSqsQueueUrl =
    "https://sqs.eu-west-2.amazonaws.com/123456789012/test-queue";
  const mockServer = { logger: { info: vi.fn() } };

  it("should return a properly configured plugin object", () => {
    const result = createCaseEventConsumer(mockSqsQueueUrl, mockServer);

    expect(result).toMatchObject({
      plugin: sqsConsumerPlugin,
      options: {
        queueUrl: mockSqsQueueUrl,
        handleMessage: expect.any(Function)
      }
    });
  });

  it("should use the provided SQS queue URL", () => {
    const result = createCaseEventConsumer(mockSqsQueueUrl, mockServer);

    expect(result.options.queueUrl).toBe(mockSqsQueueUrl);
  });

  it("should call createCaseEventHandler with the server instance", () => {
    createCaseEventConsumer(mockSqsQueueUrl, mockServer);

    expect(createCaseEventHandler).toHaveBeenCalledWith(mockServer);
  });

  it("should use the handler returned by createCaseEventHandler", () => {
    const mockHandler = vi.fn();
    createCaseEventHandler.mockReturnValueOnce(mockHandler);

    const result = createCaseEventConsumer(mockSqsQueueUrl, mockServer);

    expect(result.options.handleMessage).toBe(mockHandler);
  });
});
