import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../common/logger.js";
import { findLatestForMajor } from "../repositories/config-version.repository.js";
import {
  findByCode,
  findByCodeAndVersion,
} from "../repositories/workflow.repository.js";
import { resolveAndFetchWorkflowUseCase } from "./resolve-and-fetch-workflow.use-case.js";
import {
  __clearDefinitionCache,
  pinnedVersionOf,
  resolveCurrentWorkflowUseCase,
  resolveWorkflowForCase,
} from "./resolve-current-workflow.use-case.js";

vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../repositories/config-version.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("./resolve-and-fetch-workflow.use-case.js");

const aWorkflow = (overrides = {}) => ({
  code: "pigs-might-fly",
  getStage: vi.fn(),
  ...overrides,
});

describe("resolveCurrentWorkflowUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearDefinitionCache();
  });

  it("uses legacy findByCode when there is no pinned version", async () => {
    const workflow = aWorkflow();
    findByCode.mockResolvedValue(workflow);

    const result = await resolveCurrentWorkflowUseCase("pigs-might-fly", null);

    expect(result).toEqual({
      workflow,
      resolvedVersion: null,
      definitionSource: "mongodb",
    });
    expect(findByCode).toHaveBeenCalledWith("pigs-might-fly");
    expect(resolveAndFetchWorkflowUseCase).not.toHaveBeenCalled();
  });

  it("rolls forward to the latest version within the same major", async () => {
    const workflow = aWorkflow();
    findLatestForMajor.mockResolvedValue({ version: "1.2.3" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.2.3",
      definitionSource: "s3",
    });

    const result = await resolveCurrentWorkflowUseCase(
      "pigs-might-fly",
      "1.0.0",
    );

    expect(result).toEqual({
      workflow,
      resolvedVersion: "1.2.3",
      definitionSource: "s3",
    });
    expect(findLatestForMajor).toHaveBeenCalledWith("pigs-might-fly", 1);
    expect(resolveAndFetchWorkflowUseCase).toHaveBeenCalledWith(
      "pigs-might-fly",
      "1.2.3",
    );
  });

  it("throws notFound when no active config version exists for the major", async () => {
    findLatestForMajor.mockResolvedValue(null);

    await expect(
      resolveCurrentWorkflowUseCase("pigs-might-fly", "1.0.0"),
    ).rejects.toThrow(
      expect.objectContaining({
        output: expect.objectContaining({ statusCode: 404 }),
      }),
    );
  });

  it("serves the immutable definition from the process cache on repeat calls", async () => {
    const workflow = aWorkflow();
    findLatestForMajor.mockResolvedValue({ version: "1.0.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.0.0",
    });

    await resolveCurrentWorkflowUseCase("pigs-might-fly", "1.0.0");
    await resolveCurrentWorkflowUseCase("pigs-might-fly", "1.0.0");

    expect(resolveAndFetchWorkflowUseCase).toHaveBeenCalledTimes(1);
  });

  it("resolves once per major when a request memo is supplied", async () => {
    const workflow = aWorkflow();
    findLatestForMajor.mockResolvedValue({ version: "1.0.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.0.0",
    });
    const memo = new Map();

    await resolveCurrentWorkflowUseCase("pigs-might-fly", "1.0.0", memo);
    await resolveCurrentWorkflowUseCase("pigs-might-fly", "1.0.1", memo);

    expect(findLatestForMajor).toHaveBeenCalledTimes(1);
    expect(resolveAndFetchWorkflowUseCase).toHaveBeenCalledTimes(1);
  });
});

describe("resolveWorkflowForCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearDefinitionCache();
  });

  it("returns the rolled-forward workflow when the position still resolves", async () => {
    const workflow = aWorkflow({ getStage: vi.fn() });
    findLatestForMajor.mockResolvedValue({ version: "1.2.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.2.0",
      definitionSource: "mongodb",
    });

    const kase = {
      _id: "case-1",
      caseRef: "REF-1",
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "1.0.0",
      position: { phaseCode: "PHASE_1" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({
      workflow,
      resolvedVersion: "1.2.0",
      definitionSource: "mongodb",
      resolutionType: "roll-forward",
    });
    expect(workflow.getStage).toHaveBeenCalledWith(kase.position);
    expect(findByCodeAndVersion).not.toHaveBeenCalled();
  });

  it("falls back to the pinned version when the position is missing in the newer definition", async () => {
    const newWorkflow = aWorkflow({
      getStage: vi.fn(() => {
        throw new Error("stage not found");
      }),
    });
    const pinnedWorkflow = aWorkflow({ code: "pinned" });
    findLatestForMajor.mockResolvedValue({ version: "1.2.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow: newWorkflow,
      resolvedVersion: "1.2.0",
      definitionSource: "mongodb",
    });
    findByCodeAndVersion.mockResolvedValue(pinnedWorkflow);

    const kase = {
      _id: "case-1",
      caseRef: "REF-1",
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "1.0.0",
      position: { phaseCode: "GONE" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({
      workflow: pinnedWorkflow,
      resolvedVersion: "1.0.0",
      definitionSource: "mongodb",
      resolutionType: "fallback",
    });
    expect(findByCodeAndVersion).toHaveBeenCalledWith(
      "pigs-might-fly",
      "1.0.0",
    );
  });

  it("does not verify the position when there is no roll-forward", async () => {
    const workflow = aWorkflow({ getStage: vi.fn() });
    findLatestForMajor.mockResolvedValue({ version: "1.0.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.0.0",
      definitionSource: "cache",
    });

    const kase = {
      _id: "case-1",
      caseRef: "REF-1",
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "1.0.0",
      position: { phaseCode: "PHASE_1" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({
      workflow,
      resolvedVersion: "1.0.0",
      definitionSource: "cache",
      resolutionType: "version-match",
    });
    expect(workflow.getStage).not.toHaveBeenCalled();
  });

  it("pins to currentConfigVersion over originalConfigVersion", async () => {
    const workflow = aWorkflow({ getStage: vi.fn() });
    findLatestForMajor.mockResolvedValue({ version: "1.4.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.4.0",
      definitionSource: "cache",
    });

    const kase = {
      _id: "case-1",
      caseRef: "REF-1",
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "0.0.0",
      currentConfigVersion: "1.3.1",
      position: { phaseCode: "PHASE_1" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({
      workflow,
      resolvedVersion: "1.4.0",
      definitionSource: "cache",
      resolutionType: "roll-forward",
    });
    expect(findLatestForMajor).toHaveBeenCalledWith("pigs-might-fly", 1);
  });

  it("reports roll-forward (not fallback) when pinned workflow is unavailable", async () => {
    const newWorkflow = aWorkflow({
      getStage: vi.fn(() => {
        throw new Error("stage not found");
      }),
    });
    findLatestForMajor.mockResolvedValue({ version: "1.2.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow: newWorkflow,
      resolvedVersion: "1.2.0",
      definitionSource: "s3",
    });
    findByCodeAndVersion.mockResolvedValue(null);

    const kase = {
      _id: "case-1",
      caseRef: "REF-1",
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "1.0.0",
      position: { phaseCode: "GONE" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({
      workflow: newWorkflow,
      resolvedVersion: "1.2.0",
      definitionSource: "s3",
      resolutionType: "roll-forward",
    });
  });

  it("falls back to currentConfigVersion (not originalConfigVersion) when position is missing", async () => {
    const newWorkflow = aWorkflow({
      getStage: vi.fn(() => {
        throw new Error("stage not found");
      }),
    });
    const pinnedWorkflow = aWorkflow({ code: "pinned" });
    findLatestForMajor.mockResolvedValue({ version: "1.4.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow: newWorkflow,
      resolvedVersion: "1.4.0",
      definitionSource: "cache",
    });
    findByCodeAndVersion.mockResolvedValue(pinnedWorkflow);

    const kase = {
      _id: "case-1",
      caseRef: "REF-1",
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "0.0.0",
      currentConfigVersion: "1.3.1",
      position: { phaseCode: "GONE" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({
      workflow: pinnedWorkflow,
      resolvedVersion: "1.3.1",
      definitionSource: "mongodb",
      resolutionType: "fallback",
    });
    expect(findByCodeAndVersion).toHaveBeenCalledWith(
      "pigs-might-fly",
      "1.3.1",
    );
  });
});

describe("resolveWorkflowForCase structured logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearDefinitionCache();
  });

  const aCase = (overrides = {}) => ({
    _id: "case-123",
    caseRef: "CASE-REF-001",
    workflowCode: "pigs-might-fly",
    originalConfigVersion: "1.0.0",
    currentConfigVersion: null,
    position: { phaseCode: "PHASE_1" },
    ...overrides,
  });

  it("logs version-match with info on success", async () => {
    const workflow = aWorkflow({ getStage: vi.fn() });
    findLatestForMajor.mockResolvedValue({ version: "1.0.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.0.0",
      definitionSource: "cache",
    });

    const kase = aCase();
    await resolveWorkflowForCase(kase);

    expect(logger.info).toHaveBeenCalledWith(
      {
        event: { action: "case-workflow-resolved", outcome: "success" },
        case: { id: "case-123", reference: "CASE-REF-001" },
        workflow: {
          code: "pigs-might-fly",
          originalConfigVersion: "1.0.0",
          resolvedConfigVersion: "1.0.0",
          resolutionType: "version-match",
          definitionSource: "cache",
        },
      },
      "Resolved workflow configuration for case",
    );
  });

  it("logs roll-forward with info on success", async () => {
    const workflow = aWorkflow({ getStage: vi.fn() });
    findLatestForMajor.mockResolvedValue({ version: "1.2.3" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.2.3",
      definitionSource: "s3",
    });

    const kase = aCase();
    await resolveWorkflowForCase(kase);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: expect.objectContaining({
          resolvedConfigVersion: "1.2.3",
          resolutionType: "roll-forward",
          definitionSource: "s3",
        }),
      }),
      "Resolved workflow configuration for case",
    );
  });

  it("logs fallback with info on success", async () => {
    const newWorkflow = aWorkflow({
      getStage: vi.fn(() => {
        throw new Error("stage not found");
      }),
    });
    const pinnedWorkflow = aWorkflow({ code: "pinned" });
    findLatestForMajor.mockResolvedValue({ version: "1.2.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow: newWorkflow,
      resolvedVersion: "1.2.0",
      definitionSource: "cache",
    });
    findByCodeAndVersion.mockResolvedValue(pinnedWorkflow);

    const kase = aCase({ position: { phaseCode: "GONE" } });
    await resolveWorkflowForCase(kase);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: expect.objectContaining({
          resolvedConfigVersion: "1.0.0",
          resolutionType: "fallback",
          definitionSource: "mongodb",
        }),
      }),
      "Resolved workflow configuration for case",
    );
  });

  it("logs legacy with info when there is no stored config version", async () => {
    const workflow = aWorkflow();
    findByCode.mockResolvedValue(workflow);

    const kase = aCase({
      originalConfigVersion: null,
      currentConfigVersion: null,
    });
    await resolveWorkflowForCase(kase);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: expect.objectContaining({
          resolvedConfigVersion: null,
          resolutionType: "legacy",
          definitionSource: "mongodb",
        }),
      }),
      "Resolved workflow configuration for case",
    );
  });

  it("logs failure with error when resolution throws", async () => {
    findLatestForMajor.mockResolvedValue(null);

    const kase = aCase();

    await expect(resolveWorkflowForCase(kase)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      {
        event: { action: "case-workflow-resolved", outcome: "failure" },
        case: { id: "case-123", reference: "CASE-REF-001" },
        workflow: {
          code: "pigs-might-fly",
          originalConfigVersion: "1.0.0",
          requestedVersion: "1.0.0",
          resolvedConfigVersion: null,
        },
        error: { message: expect.any(String) },
      },
      "Failed to resolve workflow configuration for case",
    );
  });

  it("failure log includes currentConfigVersion as requestedVersion when it differs from originalConfigVersion", async () => {
    findLatestForMajor.mockResolvedValue(null);

    const kase = aCase({
      originalConfigVersion: "0.0.0",
      currentConfigVersion: "1.3.1",
    });

    await expect(resolveWorkflowForCase(kase)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow: expect.objectContaining({
          originalConfigVersion: "0.0.0",
          requestedVersion: "1.3.1",
        }),
      }),
      "Failed to resolve workflow configuration for case",
    );
  });

  it("emits error log (not success) when legacy workflow is not found", async () => {
    findByCode.mockResolvedValue(null);

    const kase = aCase({
      originalConfigVersion: null,
      currentConfigVersion: null,
    });

    await expect(resolveWorkflowForCase(kase)).rejects.toThrow(
      expect.objectContaining({
        output: expect.objectContaining({ statusCode: 404 }),
      }),
    );

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: { action: "case-workflow-resolved", outcome: "failure" },
        workflow: expect.objectContaining({
          code: "pigs-might-fly",
          requestedVersion: null,
          resolvedConfigVersion: null,
        }),
      }),
      "Failed to resolve workflow configuration for case",
    );

    const successCalls = logger.info.mock.calls.filter(
      (call) => call[1] === "Resolved workflow configuration for case",
    );
    expect(successCalls).toHaveLength(0);
  });

  it("error log contains no user IDs, payloads, requests, or responses", async () => {
    findLatestForMajor.mockResolvedValue(null);

    const kase = aCase({
      payload: { sbi: "123456789" },
      assignedUser: { id: "user-1", name: "Test User" },
    });

    await expect(resolveWorkflowForCase(kase)).rejects.toThrow();

    const errorCall = logger.error.mock.calls.find(
      (call) => call[1] === "Failed to resolve workflow configuration for case",
    );
    const logObj = errorCall[0];
    const logPayload = JSON.stringify(logObj);
    expect(logPayload).not.toContain("user-1");
    expect(logPayload).not.toContain("123456789");
    expect(logObj).not.toHaveProperty("payload");
    expect(logObj).not.toHaveProperty("request");
    expect(logObj).not.toHaveProperty("response");
  });
});

describe("pinnedVersionOf", () => {
  it("returns currentConfigVersion when present", () => {
    const kase = {
      currentConfigVersion: "1.3.1",
      originalConfigVersion: "0.0.0",
    };
    expect(pinnedVersionOf(kase)).toBe("1.3.1");
  });

  it("falls back to originalConfigVersion when currentConfigVersion is null", () => {
    const kase = {
      currentConfigVersion: null,
      originalConfigVersion: "1.0.0",
    };
    expect(pinnedVersionOf(kase)).toBe("1.0.0");
  });

  it("returns null when both are null", () => {
    const kase = {
      currentConfigVersion: null,
      originalConfigVersion: null,
    };
    expect(pinnedVersionOf(kase)).toBeNull();
  });
});
