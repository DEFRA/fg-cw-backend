import { describe, expect, it, vi } from "vitest";
import { createCaseEventHandler } from "../events/create-case-event-handler.js";
import { sqsConsumerPlugin } from "../events/sqs-consumer-plugin.js";
import { createCaseEventConsumer } from "./create-case-event-consumer.js";

vi.mock("../events/sqs-consumer-plugins.js");
vi.mock("../events/create-case-event-handler.js");

describe("createCaseEventConsumer", () => {
  const mockSqsQueueUrl =
    "https://sqs.eu-west-2.amazonaws.com/123456789012/test-queue";
  const mockServer = { logger: { info: vi.fn() } };

  it("should return a properly configured plugin object", () => {
    const handleMessage = vi.fn();

    createCaseEventHandler.mockReturnValueOnce(handleMessage);

    const result = createCaseEventConsumer(mockSqsQueueUrl, mockServer);

    expect(result).toEqual({
      plugin: sqsConsumerPlugin,
      options: {
        queueUrl: mockSqsQueueUrl,
        handleMessage,
      },
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
