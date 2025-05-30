import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCaseEventHandler } from "./create-case-event-handler.js";
import { caseService } from "../service/case.service.js";
import createCaseEvent3 from "../../test/fixtures/create-case-event-3.json";
import { caseData3 } from "../../test/fixtures/case.js";

vi.mock("../../src/service/case.service.js");

describe("createCaseEventHandler", () => {
  let mockServer;
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

    handler = createCaseEventHandler(mockServer);
    caseService.handleCreateCaseEvent.mockResolvedValue(mockCreatedCase);
  });

  it("should log received SQS message", async () => {
    await handler(createCaseEvent3);

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      "New case created for workflow: frps-private-beta with caseRef: APPLICATION-REF-3"
    );
  });

  it("should parse and process the message correctly", async () => {
    await handler(createCaseEvent3);

    expect(caseService.handleCreateCaseEvent).toHaveBeenCalledWith(
      createCaseEvent3.data,
      mockServer.db
    );
  });

  it("should log when a new case is created", async () => {
    await handler(createCaseEvent3);

    expect(mockServer.logger.info).toHaveBeenCalledWith(
      "New case created for workflow: frps-private-beta with caseRef: APPLICATION-REF-3"
    );
  });

  it("should handle errors thrown by case service", async () => {
    const error = new Error("Test error");
    caseService.handleCreateCaseEvent.mockRejectedValue(error);

    await expect(handler(createCaseEvent3)).rejects.toThrow("Test error");
  });
});
