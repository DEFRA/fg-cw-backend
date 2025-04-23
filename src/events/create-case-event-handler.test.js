import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCaseEventHandler } from "./create-case-event-handler.js";
import { caseService } from "../service/case.service.js";

// Mock the caseService
vi.mock("../../src/service/case.service.js", () => ({
  caseService: {
    handleCreateCaseEvent: vi.fn()
  }
}));

describe("createCaseEventHandler", () => {
  let mockServer;
  let mockMessage;
  let mockCreateNewCaseEvent;
  let handler;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      logger: {
        info: vi.fn()
      },
      db: {}
    };

    // Create mock SQS message
    mockCreateNewCaseEvent = {
      clientRef: "TEST-REF-123",
      code: "GRANT-TEST-1",
      createdAt: "2023-04-15T10:34:52.000Z",
      submittedAt: "2023-04-16T11:30:52.000Z",
      identifiers: {
        sbi: "SBI123",
        frn: "FIRM123",
        crn: "CUST123"
      },
      answers: {
        scheme: "TEST-SCHEME",
        year: 2023
      }
    };

    mockMessage = {
      Body: JSON.stringify({
        Message: JSON.stringify(mockCreateNewCaseEvent)
      })
    };

    handler = createCaseEventHandler(mockServer);

    caseService.handleCreateCaseEvent.mockResolvedValue({
      workflowCode: "GRANT-TEST-1",
      caseRef: "TEST-REF-123"
    });
  });

  it("should log received SQS message", async () => {
    await handler(mockMessage);

    expect(mockServer.logger.info).toHaveBeenCalledWith({
      message: "Received SQS message",
      body: mockMessage.Body
    });
  });

  it("should parse and process the message correctly", async () => {
    await handler(mockMessage);

    // Check dates are converted to Date objects
    expect(caseService.handleCreateCaseEvent).toHaveBeenCalledWith(
      {
        ...mockCreateNewCaseEvent,
        createdAt: expect.any(Date),
        submittedAt: expect.any(Date)
      },
      mockServer.db
    );
  });

  it("should log when a new case is created", async () => {
    await handler(mockMessage);

    expect(mockServer.logger.info).toHaveBeenCalledWith({
      message:
        "New case created for workflow: GRANT-TEST-1 with caseRef: TEST-REF-123",
      body: mockMessage.Body
    });
  });

  it("should handle errors thrown by case service", async () => {
    const error = new Error("Test error");
    caseService.handleCreateCaseEvent.mockRejectedValue(error);

    await expect(handler(mockMessage)).rejects.toThrow("Test error");
  });

  it("should handle malformed messages", async () => {
    const malformedMessage = {
      Body: "Invalid JSON"
    };

    await expect(handler(malformedMessage)).rejects.toThrow();
  });
});
