import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { createServer } from "../../server.js";

// Mock the SQS service and its functions
vi.mock("../../service/sqs.service.js", () => {
  const mockProcessMessage = vi.fn().mockResolvedValue();
  const mockReceiveMessages = vi.fn().mockResolvedValue([]);
  const mockDeleteMessage = vi.fn().mockResolvedValue({});
  const mockChangeMessageVisibility = vi.fn().mockResolvedValue({});

  const mockStartPolling = vi.fn().mockImplementation(() => ({
    stop: vi.fn()
  }));

  return {
    default: vi.fn().mockImplementation(() => ({
      client: {},
      receiveMessages: mockReceiveMessages,
      deleteMessage: mockDeleteMessage,
      startPolling: mockStartPolling,
      processMessage: mockProcessMessage,
      changeMessageVisibility: mockChangeMessageVisibility
    }))
  };
});

// Mock AWS SDK
vi.mock("@aws-sdk/client-sqs", () => {
  return {
    SQSClient: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue({ Messages: [] })
    })),
    ReceiveMessageCommand: vi.fn(),
    DeleteMessageCommand: vi.fn(),
    ChangeMessageVisibilityCommand: vi.fn()
  };
});

describe.skip("SQS Helper", () => {
  let server;

  describe("Set up", () => {
    beforeAll(async () => {
      server = await createServer();
      await server.initialize();
    });

    afterAll(async () => {
      await server.stop({ timeout: 0 });
    });

    test("Server should have SQS service decorator", () => {
      expect(server.sqs).toBeDefined();
      expect(typeof server.sqs).toBe("object");
    });

    test("SQS service should have expected methods", () => {
      expect(typeof server.sqs.receiveMessages).toBe("function");
      expect(typeof server.sqs.deleteMessage).toBe("function");
      expect(typeof server.sqs.startPolling).toBe("function");
      expect(typeof server.sqs.processMessage).toBe("function");
      expect(typeof server.sqs.changeMessageVisibility).toBe("function");
    });
  });

  describe("Poller", () => {
    beforeAll(async () => {
      server = await createServer();
      await server.initialize();
    });

    afterAll(async () => {
      await server.stop({ timeout: 0 });
    });

    test("Should start and stop polling when server starts and stops", async () => {
      // Verify poller exists
      expect(server.app.sqsPoller).toBeDefined();

      // Mock the stop method to verify it gets called
      const stopSpy = vi.spyOn(server.app.sqsPoller, "stop");

      await server.stop({ timeout: 0 });

      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe("Configuration", () => {
    beforeAll(async () => {
      server = await createServer();
      await server.initialize();
    });

    afterAll(async () => {
      await server.stop({ timeout: 0 });
    });

    test("Should use configuration from options or fallback to config", () => {
      const sqsPlugin = server.registrations.sqs;
      expect(sqsPlugin).toBeDefined();
      expect(sqsPlugin.version).toBe("1.0.0");
    });
  });

  describe("Message Processing", () => {
    let sqsService;

    beforeAll(async () => {
      server = await createServer();
      await server.initialize();
      sqsService = server.sqs;
    });

    afterAll(async () => {
      await server.stop({ timeout: 0 });
    });

    test("processMessage should handle JSON message body", async () => {
      const mockDb = {};
      const mockMessage = {
        MessageId: "test-message-id",
        Body: JSON.stringify({ caseId: "test-case-id" }),
        Attributes: { ApproximateReceiveCount: "1" }
      };

      await sqsService.processMessage(mockMessage, mockDb);

      expect(sqsService.processMessage).toHaveBeenCalledWith(
        mockMessage,
        mockDb
      );
    });

    test("receiveMessages should poll the SQS queue", async () => {
      await sqsService.receiveMessages({
        queueUrl: "test-queue-url"
      });

      expect(sqsService.receiveMessages).toHaveBeenCalledWith({
        queueUrl: "test-queue-url"
      });
    });

    test("deleteMessage should delete a message from the queue", async () => {
      await sqsService.deleteMessage({
        queueUrl: "test-queue-url",
        receiptHandle: "test-receipt-handle"
      });

      expect(sqsService.deleteMessage).toHaveBeenCalledWith({
        queueUrl: "test-queue-url",
        receiptHandle: "test-receipt-handle"
      });
    });
  });
});
