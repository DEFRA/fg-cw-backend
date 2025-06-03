import { describe, it, expect, vi, beforeEach } from "vitest";
import { SqsConsumer } from "./sqs-consumer.js";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand
} from "@aws-sdk/client-sqs";
import { logger } from "../common/logger.js";

vi.mock("../common/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock("@aws-sdk/client-sqs");
vi.mock("../common/config.js", () => ({
  config: {
    get: vi.fn(
      (key) =>
        ({
          "aws.sqsEndpoint": "http://localhost:4566",
          "aws.awsRegion": "eu-west-2",
          "aws.sqsMaxNumberOfMessages": 10,
          "aws.sqsWaitTimeInSeconds": 20
        })[key]
    )
  }
}));

describe("SqsConsumer", () => {
  let consumer;
  let mockServer;
  let mockHandleMessage;

  beforeEach(async () => {
    mockServer = {
      logger: {
        info: vi.fn(),
        error: vi.fn()
      }
    };

    mockHandleMessage = vi.fn().mockResolvedValue();

    consumer = new SqsConsumer(mockServer, {
      queueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/test-queue",
      handleMessage: mockHandleMessage
    });
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
        region: "eu-west-2"
      });
    });
  });

  describe("start", () => {
    it("should set isRunning to true and start polling", async () => {
      consumer.poll = vi.fn().mockResolvedValue();

      await consumer.start();

      expect(consumer.isRunning).toBe(true);
      expect(consumer.poll).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Started polling SQS queue")
      );
    });
  });

  describe("stop", () => {
    it("should set isRunning to false and log stop message", async () => {
      consumer.isRunning = true;

      await consumer.stop();

      expect(consumer.isRunning).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Stopped polling SQS queue")
      );
    });
  });

  describe("message processing", () => {
    it("should process and delete messages correctly", async () => {
      const mockMessages = [
        {
          MessageId: "msg-1",
          Body: "Test message 1",
          ReceiptHandle: "receipt-1"
        }
      ];

      consumer.sqsClient.send.mockImplementation(async (command) => {
        if (command instanceof ReceiveMessageCommand) {
          return { Messages: mockMessages };
        }
        if (command instanceof DeleteMessageCommand) {
          return {};
        }
        return {};
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

      await processOneMessage();

      expect(ReceiveMessageCommand).toHaveBeenCalledWith({
        QueueUrl: consumer.queueUrl,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        AttributeNames: ["All"],
        MessageAttributeNames: ["All"]
      });

      expect(mockHandleMessage).toHaveBeenCalledWith(mockMessages[0]);

      expect(DeleteMessageCommand).toHaveBeenCalledWith({
        QueueUrl: consumer.queueUrl,
        ReceiptHandle: "receipt-1"
      });
    });

    it("should handle errors when processing messages", async () => {
      const mockMessages = [
        {
          MessageId: "msg-1",
          Body: "Test message 1",
          ReceiptHandle: "receipt-1"
        }
      ];

      consumer.sqsClient.send.mockImplementation(async (command) => {
        if (command instanceof ReceiveMessageCommand) {
          return { Messages: mockMessages };
        }
        return {};
      });

      mockHandleMessage.mockRejectedValueOnce(new Error("Test error"));

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
              logger.error({
                error: err.message,
                message: "Failed to process SQS message",
                messageId: message.MessageId
              });
            }
          }
        }
      };

      await processOneMessage();

      expect(logger.error).toHaveBeenCalledWith({
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
      expect(consumer.sqsClient.send).toHaveBeenCalled();
    });
  });
});
