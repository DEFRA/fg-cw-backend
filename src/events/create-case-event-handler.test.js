import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCaseEventHandler } from "./create-case-event-handler.js";
import { caseService } from "../service/case.service.js";
import createCaseEvent3 from "../../test/fixtures/create-case-event-3.json";
import { caseData3 } from "../../test/fixtures/case.js";
// Mock the caseService
vi.mock("../../src/service/case.service.js", () => ({
  caseService: {
    handleCreateCaseEvent: vi.fn()
  }
}));

describe("createCaseEventHandler", () => {
  let mockServer;
  let mockMessage;
  let handler;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      logger: {
        info: vi.fn()
      },
      db: {}
    };

    const insertedId = "insertedId123";
    const mockCreatedCase = { _id: insertedId, ...caseData3 };

    mockMessage = {
      Body: JSON.stringify(createCaseEvent3)
    };

    handler = createCaseEventHandler(mockServer);
    caseService.handleCreateCaseEvent.mockResolvedValue(mockCreatedCase);
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
        ...createCaseEvent3,
        createdAt: expect.any(Date),
        submittedAt: expect.any(Date)
      },
      mockServer.db
    );
  });

  it("should log when a new case is created", async () => {
    await handler(mockMessage);

    expect(mockServer.logger.info).toHaveBeenCalledWith({
      message: "Received SQS message",
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
