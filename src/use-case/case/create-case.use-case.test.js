import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCaseUseCase } from "./create-case.use-case.js";
import { caseRepository } from "../../repository/case.repository.js";
import { CaseModel } from "../../models/case-model.js";

// Mock dependencies
vi.mock("../../repository/case.repository.js", () => ({
  caseRepository: {
    insert: vi.fn()
  }
}));

vi.mock("../../models/case-model.js", () => ({
  CaseModel: {
    newCase: vi.fn()
  }
}));

describe("createCaseUseCase", () => {
  const mockCreateCaseCommand = {
    caseRef: "CASE-123",
    workflowCode: "test-workflow",
    payload: {
      clientRef: "CLIENT-123",
      code: "test-code"
    }
  };

  const mockCaseData = {
    id: "case-id-123",
    caseRef: "CASE-123",
    workflowCode: "test-workflow",
    payload: {
      clientRef: "CLIENT-123",
      code: "test-code"
    },
    dateReceived: "2023-07-01T10:00:00.000Z",
    status: "PENDING"
  };

  beforeEach(() => {
    CaseModel.newCase.mockReturnValue(mockCaseData);
    caseRepository.insert.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new case using the CaseModel and insert it into the repository", async () => {
    // Act
    await createCaseUseCase(mockCreateCaseCommand);

    // Assert
    expect(CaseModel.newCase).toHaveBeenCalledTimes(1);
    expect(CaseModel.newCase).toHaveBeenCalledWith(mockCreateCaseCommand);
    expect(caseRepository.insert).toHaveBeenCalledTimes(1);
    expect(caseRepository.insert).toHaveBeenCalledWith(mockCaseData);
  });

  it("should propagate errors from the repository", async () => {
    // Arrange
    const expectedError = new Error("Database error");
    caseRepository.insert.mockRejectedValueOnce(expectedError);

    // Act & Assert
    await expect(createCaseUseCase(mockCreateCaseCommand)).rejects.toThrow(
      expectedError
    );
    expect(CaseModel.newCase).toHaveBeenCalledTimes(1);
    expect(caseRepository.insert).toHaveBeenCalledTimes(1);
  });

  it("should propagate errors from the CaseModel", async () => {
    // Arrange
    const expectedError = new Error("Validation error");
    CaseModel.newCase.mockImplementationOnce(() => {
      throw expectedError;
    });

    // Act & Assert
    await expect(createCaseUseCase(mockCreateCaseCommand)).rejects.toThrow(
      expectedError
    );
    expect(CaseModel.newCase).toHaveBeenCalledTimes(1);
    expect(caseRepository.insert).not.toHaveBeenCalled();
  });
});
