import { describe, expect, it, vi } from "vitest";
import { performPageActionRoute } from "./perform-page-action.route.js";

vi.mock("../use-cases/perform-page-action.use-case.js");

describe("performPageActionRoute", () => {
  it("should have correct route configuration", () => {
    expect(performPageActionRoute.method).toBe("POST");
    expect(performPageActionRoute.path).toBe("/cases/{caseId}/page-action");
    expect(performPageActionRoute.options.description).toBe(
      "Perform a page action for a case",
    );
    expect(performPageActionRoute.options.tags).toEqual(["api"]);
  });

  it("should have validation for caseId param", () => {
    const { validate } = performPageActionRoute.options;
    expect(validate.params).toBeDefined();

    const validResult = validate.params.validate({
      caseId: "64c88faac1f56f71e1b89a33",
    });
    expect(validResult.error).toBeUndefined();

    const invalidResult = validate.params.validate({ caseId: "invalid" });
    expect(invalidResult.error).toBeDefined();
  });

  it("should have validation for payload", () => {
    const { validate } = performPageActionRoute.options;
    expect(validate.payload).toBeDefined();
  });

  it("should call use case and return 204", async () => {
    const { performPageActionUseCase } = await import(
      "../use-cases/perform-page-action.use-case.js"
    );

    const mockResponse = {
      code: vi.fn().mockReturnThis(),
    };

    const mockH = {
      response: vi.fn().mockReturnValue(mockResponse),
    };

    const mockRequest = {
      params: {
        caseId: "64c88faac1f56f71e1b89a33",
      },
      payload: {
        actionCode: "TEST_ACTION",
      },
    };

    vi.mocked(performPageActionUseCase).mockResolvedValue({ data: "test" });

    const result = await performPageActionRoute.handler(mockRequest, mockH);

    expect(performPageActionUseCase).toHaveBeenCalledWith({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "TEST_ACTION",
    });
    expect(mockH.response).toHaveBeenCalled();
    expect(mockResponse.code).toHaveBeenCalledWith(204);
    expect(result).toBe(mockResponse);
  });

  it("should handle different action codes", async () => {
    const { performPageActionUseCase } = await import(
      "../use-cases/perform-page-action.use-case.js"
    );

    const mockResponse = {
      code: vi.fn().mockReturnThis(),
    };

    const mockH = {
      response: vi.fn().mockReturnValue(mockResponse),
    };

    const mockRequest = {
      params: {
        caseId: "64c88faac1f56f71e1b89a33",
      },
      payload: {
        actionCode: "RECALCULATE_RULES",
      },
    };

    vi.mocked(performPageActionUseCase).mockResolvedValue({ id: 123 });

    await performPageActionRoute.handler(mockRequest, mockH);

    expect(performPageActionUseCase).toHaveBeenCalledWith({
      caseId: "64c88faac1f56f71e1b89a33",
      actionCode: "RECALCULATE_RULES",
    });
    expect(mockResponse.code).toHaveBeenCalledWith(204);
  });

  it("should propagate errors from use case", async () => {
    const { performPageActionUseCase } = await import(
      "../use-cases/perform-page-action.use-case.js"
    );

    const mockH = {
      response: vi.fn(),
    };

    const mockRequest = {
      params: {
        caseId: "64c88faac1f56f71e1b89a33",
      },
      payload: {
        actionCode: "INVALID_ACTION",
      },
    };

    const testError = new Error("External action not found");
    vi.mocked(performPageActionUseCase).mockRejectedValue(testError);

    await expect(
      performPageActionRoute.handler(mockRequest, mockH),
    ).rejects.toThrow("External action not found");

    expect(mockH.response).not.toHaveBeenCalled();
  });

  it("should validate caseId length", () => {
    const { validate } = performPageActionRoute.options;

    const shortId = validate.params.validate({ caseId: "abc123" });
    expect(shortId.error).toBeDefined();
    expect(shortId.error.message).toContain("length must be 24");

    const longId = validate.params.validate({
      caseId: "64c88faac1f56f71e1b89a3364c88faac1f56f71e1b89a33",
    });
    expect(longId.error).toBeDefined();
  });

  it("should validate caseId is hex", () => {
    const { validate } = performPageActionRoute.options;

    const nonHexId = validate.params.validate({
      caseId: "xxxxxxxxxxxxxxxxxxxxxxxx",
    });
    expect(nonHexId.error).toBeDefined();
    expect(nonHexId.error.message).toContain("hex");
  });

  it("should have response schema for 400 error", () => {
    const { response } = performPageActionRoute.options;
    expect(response.status[400]).toBeDefined();
  });
});
