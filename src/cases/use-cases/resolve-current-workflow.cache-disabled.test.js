import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/config-version.repository.js");
vi.mock("./resolve-and-fetch-workflow.use-case.js");

const aWorkflow = () => ({
  code: "pigs-might-fly",
  getStage: vi.fn(),
});

describe("resolveCurrentWorkflowUseCase with cache disabled", () => {
  beforeEach(() => {
    vi.stubEnv("WORKFLOW_DEFINITION_CACHE_ENABLED", "false");
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not reuse the process cache on repeat resolves", async () => {
    const { findLatestForMajor } = await import(
      "../repositories/config-version.repository.js"
    );
    const { resolveAndFetchWorkflowUseCase } = await import(
      "./resolve-and-fetch-workflow.use-case.js"
    );
    const {
      resolveCurrentWorkflowUseCase,
      __clearDefinitionCache,
    } = await import("./resolve-current-workflow.use-case.js");

    const workflow = aWorkflow();
    findLatestForMajor.mockResolvedValue({ version: "1.0.0" });
    resolveAndFetchWorkflowUseCase.mockResolvedValue({
      workflow,
      resolvedVersion: "1.0.0",
    });

    await resolveCurrentWorkflowUseCase("pigs-might-fly", "1.0.0");
    await resolveCurrentWorkflowUseCase("pigs-might-fly", "1.0.0");

    expect(resolveAndFetchWorkflowUseCase).toHaveBeenCalledTimes(2);
    __clearDefinitionCache();
  });
});
