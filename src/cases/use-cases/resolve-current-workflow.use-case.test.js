import { beforeEach, describe, expect, it, vi } from "vitest";
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

    expect(result).toEqual({ workflow, resolvedVersion: null });
    expect(findByCode).toHaveBeenCalledWith("pigs-might-fly");
    expect(resolveAndFetchWorkflowUseCase).not.toHaveBeenCalled();
  });

  it("rolls forward to the latest version within the same major", async () => {
    const workflow = aWorkflow();
    findLatestForMajor.mockResolvedValue({ version: "1.2.3" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.2.3",
    });

    const result = await resolveCurrentWorkflowUseCase(
      "pigs-might-fly",
      "1.0.0",
    );

    expect(result).toEqual({ workflow, resolvedVersion: "1.2.3" });
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
    });

    const kase = {
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "1.0.0",
      position: { phaseCode: "PHASE_1" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({ workflow, resolvedVersion: "1.2.0" });
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
    });
    findByCodeAndVersion.mockResolvedValue(pinnedWorkflow);

    const kase = {
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "1.0.0",
      position: { phaseCode: "GONE" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({
      workflow: pinnedWorkflow,
      resolvedVersion: "1.0.0",
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
    });

    const kase = {
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "1.0.0",
      position: { phaseCode: "PHASE_1" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({ workflow, resolvedVersion: "1.0.0" });
    expect(workflow.getStage).not.toHaveBeenCalled();
  });

  it("pins to currentConfigVersion over originalConfigVersion", async () => {
    const workflow = aWorkflow({ getStage: vi.fn() });
    findLatestForMajor.mockResolvedValue({ version: "1.4.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.4.0",
    });

    const kase = {
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "0.0.0",
      currentConfigVersion: "1.3.1",
      position: { phaseCode: "PHASE_1" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({ workflow, resolvedVersion: "1.4.0" });
    expect(findLatestForMajor).toHaveBeenCalledWith("pigs-might-fly", 1);
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
    });
    findByCodeAndVersion.mockResolvedValue(pinnedWorkflow);

    const kase = {
      workflowCode: "pigs-might-fly",
      originalConfigVersion: "0.0.0",
      currentConfigVersion: "1.3.1",
      position: { phaseCode: "GONE" },
    };

    const result = await resolveWorkflowForCase(kase);

    expect(result).toEqual({
      workflow: pinnedWorkflow,
      resolvedVersion: "1.3.1",
    });
    expect(findByCodeAndVersion).toHaveBeenCalledWith(
      "pigs-might-fly",
      "1.3.1",
    );
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
