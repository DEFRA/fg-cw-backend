import { describe, it, expect, vi } from "vitest";
import { eventController } from "./event.controller.js";
import { caseService } from "../services/case.service.js";
import createCaseEvent1 from "../../test/fixtures/create-case-event-1.json";
import { caseData1 } from "../../test/fixtures/case.js";

vi.mock("../services/case.service.js");

describe("eventController", () => {
  it("should call caseService.handleCreateCaseEvent with correct payload", async () => {
    const insertedId = "insertedId123";
    const mockCreatedCase = { _id: insertedId, ...caseData1 };
    const mockRequest = {
      payload: createCaseEvent1
    };
    const mockResponse = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn()
    };

    // Mock the services to avoid actual execution
    caseService.handleCreateCaseEvent.mockResolvedValue(mockCreatedCase);

    // Act
    await eventController(mockRequest, mockResponse);

    // Assert
    expect(caseService.handleCreateCaseEvent).toHaveBeenCalledOnce();
    expect(caseService.handleCreateCaseEvent).toHaveBeenCalledWith(
      createCaseEvent1
    );
  });

  it("should return a 201 status code with the response from caseService", async () => {
    const insertedId = "insertedId123";
    const mockCreatedCase = { _id: insertedId, ...caseData1 };
    const mockRequest = {
      payload: createCaseEvent1
    };
    const mockResponse = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn()
    };

    // Mock the services to return resolved data
    caseService.handleCreateCaseEvent.mockResolvedValue(mockCreatedCase);

    // Act
    await eventController(mockRequest, mockResponse);

    // Assert
    expect(mockResponse.code).toHaveBeenCalledWith(201);
  });

  it("should handle errors from caseService gracefully", async () => {
    // Arrange mock data
    const mockRequest = {
      payload: createCaseEvent1
    };
    const mockResponse = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn()
    };

    // Mock caseService to throw an error
    caseService.handleCreateCaseEvent.mockRejectedValue(
      new Error("Service error")
    );

    // Act & Assert
    await expect(eventController(mockRequest, mockResponse)).rejects.toThrow(
      "Service error"
    );
    expect(caseService.handleCreateCaseEvent).toHaveBeenCalledOnce();
    expect(caseService.handleCreateCaseEvent).toHaveBeenCalledWith(
      mockRequest.payload
    );
  });
});
