import { describe, it, expect, vi, afterEach } from "vitest";
import { eventController } from "./event.controller.js";
import { caseUseCase } from "../../use-case/case/case.use-case.js";
import createCaseEvent1 from "../../../test/fixtures/create-case-event-1.json";
import { caseData1 } from "../../../test/fixtures/case.js";

vi.mock("../service/handlers.service.js", () => ({
  caseService: {
    handleCreateCaseEvent: vi.fn()
  }
}));

describe("eventController", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should call caseUseCase.handleCreateCaseEvent with correct payload and db", async () => {
    const insertedId = "insertedId123";
    const mockCreatedCase = { _id: insertedId, ...caseData1 };
    const mockRequest = { payload: createCaseEvent1 };

    const mockCode = vi.fn();
    const mockResponse = {
      response: vi.fn().mockReturnValue({ code: mockCode })
    };

    // Mock the service to return resolved data
    vi.spyOn(caseUseCase, "handleCreateCaseEvent").mockResolvedValue(
      mockCreatedCase
    );

    // Act
    await eventController(mockRequest, mockResponse);

    // Assert
    expect(caseUseCase.handleCreateCaseEvent).toHaveBeenCalledOnce();
    expect(caseUseCase.handleCreateCaseEvent).toHaveBeenCalledWith(
      createCaseEvent1
    );
  });

  it("should return a 201 status code with the response from caseUseCase", async () => {
    const insertedId = "insertedId123";
    const mockCreatedCase = { _id: insertedId, ...caseData1 };
    const mockRequest = {
      payload: createCaseEvent1,
      db: {}
    };
    const mockResponse = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn()
    };

    // Mock the service to return resolved data
    vi.spyOn(caseUseCase, "handleCreateCaseEvent").mockResolvedValue(
      mockCreatedCase
    );

    // Act
    await eventController(mockRequest, mockResponse);

    // Assert
    expect(mockResponse.response).toHaveBeenCalledWith(mockCreatedCase);
    expect(mockResponse.code).toHaveBeenCalledWith(201);
  });

  it("should handle errors from caseUseCase gracefully", async () => {
    // Arrange mock data
    const mockRequest = {
      payload: createCaseEvent1,
      db: {}
    };
    const mockResponse = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn()
    };

    // Mock caseUseCase to throw an error
    vi.spyOn(caseUseCase, "handleCreateCaseEvent").mockRejectedValue(
      new Error("Service error")
    );

    // Act & Assert
    await expect(eventController(mockRequest, mockResponse)).rejects.toThrow(
      "Service error"
    );
    expect(caseUseCase.handleCreateCaseEvent).toHaveBeenCalledOnce();
    expect(caseUseCase.handleCreateCaseEvent).toHaveBeenCalledWith(
      mockRequest.payload
    );
  });
});
