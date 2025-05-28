import { describe, it, expect, vi, beforeEach } from "vitest";
import { caseCreateController } from "./create-case.controller.js";
import { createCaseUseCase } from "../../use-case/case/create-case.use-case.js";
import { caseData1 } from "../../../test/fixtures/case.js";

vi.mock("../../use-case/case/create-case.use-case.js", () => ({
  createCaseUseCase: vi.fn()
}));

describe("caseCreateController", () => {
  let h;

  beforeEach(() => {
    vi.clearAllMocks();

    h = {
      response: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis()
    };
  });

  it("should call createCaseUseCase with the request payload", async () => {
    // Act
    await caseCreateController(caseData1, h);

    // Assert
    expect(createCaseUseCase).toHaveBeenCalledTimes(1);
    expect(createCaseUseCase).toHaveBeenCalledWith(caseData1.payload);
  });

  it("should return a 201 response with an empty object", async () => {
    // Act
    await caseCreateController(caseData1, h);

    // Assert
    expect(h.response).toHaveBeenCalledTimes(1);
    expect(h.response).toHaveBeenCalledWith({});
    expect(h.code).toHaveBeenCalledTimes(1);
    expect(h.code).toHaveBeenCalledWith(201);
  });

  it("should propagate any errors thrown by the use case", async () => {
    // Arrange
    const testError = new Error("Test error");
    createCaseUseCase.mockRejectedValueOnce(testError);

    // Act & Assert
    await expect(caseCreateController(caseData1, h)).rejects.toThrow(testError);
    expect(h.response).not.toHaveBeenCalled();
    expect(h.code).not.toHaveBeenCalled();
  });
});
