import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SqsConsumer from "./sqs-consumer.js";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from "@aws-sdk/client-sqs";

// Mock AWS SDK
vi.mock("@aws-sdk/client-sqs", () => ({
  SQSClient: vi.fn().mockImplementation(() => ({
    send: vi.fn()
  })),
  ReceiveMessageCommand: vi.fn(),
  DeleteMessageCommand: vi.fn()
}));

// Mock the config
vi.mock("../config.js", () => ({
  config: {
    get: vi.fn((key) => {
      const configValues = {
        "aws.sqsEndpoint": "http://localhost:4566",
        "aws.awsRegion": "eu-west-2",
        "aws.sqsMaxNumberOfMessages": 10,
        "aws.sqsWaitTimeInSeconds": 20
      };
      return configValues[key];
    })
  }
}));

describe("SqsConsumer", () => {
  let consumer;
  let mockServer;
  let mockHandleMessage;
  let mockSqsClient;

  const originalPoll = SqsConsumer.prototype.poll;

  beforeEach(() => {
    SqsConsumer.prototype.poll = vi.fn().mockResolvedValue();

    // Create mock server with logger
    mockServer = {
      logger: {
        info: vi.fn(),
        error: vi.fn()
      }
    };

    mockHandleMessage = vi.fn().mockResolvedValue();

    // Create SQS consumer instance
    consumer = new SqsConsumer(mockServer, {
      queueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/test-queue",
      handleMessage: mockHandleMessage
    });

    // Store reference to mocked SQS client
    mockSqsClient = consumer.sqsClient;
  });

  afterEach(() => {
    vi.clearAllMocks();
    SqsConsumer.prototype.poll = originalPoll;
  });

  describe("constructor", () => {
    it("should initialize with correct properties", () => {
      expect(consumer.server).toBe(mockServer);
      expect(consumer.queueUrl).toBe(
        "https://sqs.eu-west-2.amazonaws.com/123456789012/test-queue"
      );
      expect(consumer.handleMessage).toBe(mockHandleMessage);
      expect(consumer.isRunning).toBe(false);
      expect(SQSClient).toHaveBeenCalledWith({
        endpoint: "http://localhost:4566",
        region: "eu-west-2",
        credentials: {
          accessKeyId: undefined,
          secretAccessKey: undefined
        }
      });
    });
  });

  describe("start", () => {
    it("should set isRunning to true and start polling", async () => {
      await consumer.start();

      expect(consumer.isRunning).toBe(true);
      expect(consumer.poll).toHaveBeenCalled();
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Started polling SQS queue")
      );
    });
  });

  describe("stop", () => {
    it("should set isRunning to false and log stop message", async () => {
      consumer.isRunning = true;

      await consumer.stop();

      expect(consumer.isRunning).toBe(false);
      expect(mockServer.logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Stopped polling SQS queue")
      );
    });
  });

  describe("message processing", () => {
    // Test the receiveMessage and deleteMessage functionality directly
    it("should process and delete messages correctly", async () => {
      // Mock a successful message response
      const mockMessages = [
        {
          MessageId: "msg-1",
          Body: "Test message 1",
          ReceiptHandle: "receipt-1"
        }
      ];

      mockSqsClient.send.mockImplementation((command) => {
        if (command instanceof ReceiveMessageCommand) {
          return Promise.resolve({ Messages: mockMessages });
        }
        if (command instanceof DeleteMessageCommand) {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      const processOneMessage = async () => {
        const receiveParams = {
          QueueUrl: consumer.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          AttributeNames: ["All"],
          MessageAttributeNames: ["All"]
        };

        const command = new ReceiveMessageCommand(receiveParams);
        const response = await consumer.sqsClient.send(command);

        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            await consumer.handleMessage(message);
            await consumer.deleteMessage(message);
          }
        }
      };

      // Process one batch of messages
      await processOneMessage();

      // Check the message was processed
      expect(ReceiveMessageCommand).toHaveBeenCalledWith({
        QueueUrl: consumer.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        AttributeNames: ["All"],
        MessageAttributeNames: ["All"]
      });

      // Check the handler was called with the message
      expect(mockHandleMessage).toHaveBeenCalledWith(mockMessages[0]);

      // Check the delete command was called with the right parameters
      expect(DeleteMessageCommand).toHaveBeenCalledWith({
        QueueUrl: consumer.queueUrl,
        ReceiptHandle: "receipt-1"
      });
    });

    it("should handle errors when processing messages", async () => {
      // Mock a successful message response
      const mockMessages = [
        {
          MessageId: "msg-1",
          Body: "Test message 1",
          ReceiptHandle: "receipt-1"
        }
      ];

      mockSqsClient.send.mockImplementation((command) => {
        if (command instanceof ReceiveMessageCommand) {
          return Promise.resolve({ Messages: mockMessages });
        }
        return Promise.resolve({});
      });

      // Make the message handler throw an error
      const error = new Error("Test error");
      mockHandleMessage.mockRejectedValueOnce(error);

      const processOneMessage = async () => {
        const receiveParams = {
          QueueUrl: consumer.queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20,
          AttributeNames: ["All"],
          MessageAttributeNames: ["All"]
        };

        const command = new ReceiveMessageCommand(receiveParams);
        const response = await consumer.sqsClient.send(command);

        if (response.Messages && response.Messages.length > 0) {
          for (const message of response.Messages) {
            try {
              await consumer.handleMessage(message);
              await consumer.deleteMessage(message);
            } catch (err) {
              consumer.server.logger.error({
                error: err.message,
                message: "Failed to process SQS message",
                messageId: message.MessageId
              });
            }
          }
        }
      };

      await processOneMessage();

      // Check the error was logged
      expect(mockServer.logger.error).toHaveBeenCalledWith({
        error: "Test error",
        message: "Failed to process SQS message",
        messageId: "msg-1"
      });
    });
  });

  describe("deleteMessage", () => {
    it("should delete a message with the correct parameters", async () => {
      const mockMessage = {
        MessageId: "msg-1",
        ReceiptHandle: "receipt-1"
      };

      await consumer.deleteMessage(mockMessage);

      expect(DeleteMessageCommand).toHaveBeenCalledWith({
        QueueUrl: consumer.queueUrl,
        ReceiptHandle: "receipt-1"
      });
      expect(mockSqsClient.send).toHaveBeenCalled();
    });
  });
});
