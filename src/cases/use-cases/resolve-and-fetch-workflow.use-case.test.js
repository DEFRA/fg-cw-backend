import { beforeEach, describe, expect, it, vi } from "vitest";
import { FetchStatus } from "../../common/fetch-status.js";
import { ConfigVersion } from "../models/config-version.js";
import { Workflow } from "../models/workflow.js";
import { resolveAndFetchWorkflowUseCase } from "./resolve-and-fetch-workflow.use-case.js";

vi.mock("../../common/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const { mockFindLatestPatch, mockUpdateFetchStatus } = vi.hoisted(() => ({
  mockFindLatestPatch: vi.fn(),
  mockUpdateFetchStatus: vi.fn(),
}));

vi.mock("../repositories/config-version.repository.js", () => ({
  findLatestPatch: mockFindLatestPatch,
  updateFetchStatus: mockUpdateFetchStatus,
}));

const { mockFindByCodeAndVersion, mockSaveFromDefinition } = vi.hoisted(() => ({
  mockFindByCodeAndVersion: vi.fn(),
  mockSaveFromDefinition: vi.fn(),
}));

vi.mock("../repositories/workflow.repository.js", () => ({
  findByCodeAndVersion: mockFindByCodeAndVersion,
  saveFromDefinition: mockSaveFromDefinition,
}));

const { mockFetchConfigFile } = vi.hoisted(() => ({
  mockFetchConfigFile: vi.fn(),
}));

vi.mock("../../common/s3-client.js", () => ({
  fetchConfigFile: mockFetchConfigFile,
  S3FetchError: class S3FetchError extends Error {
    constructor(message, { statusCode, code, key, bucket } = {}) {
      super(message);
      this.name = "S3FetchError";
      this.statusCode = statusCode;
      this.code = code;
      this.key = key;
      this.bucket = bucket;
    }

    get isPermanent() {
      return this.statusCode === 404 || this.statusCode === 403;
    }

    get isParseError() {
      return this.code === "PARSE_ERROR";
    }
  },
}));

describe("resolveAndFetchWorkflowUseCase", () => {
  const mockWorkflow = Workflow.createMock({ code: "pigs-might-fly" });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateFetchStatus.mockResolvedValue({ modifiedCount: 1 });
  });

  it("should return cached workflow when fetchStatus is fetched", async () => {
    const cv = ConfigVersion.createMock({
      fetchStatus: FetchStatus.Fetched,
    });
    mockFindLatestPatch.mockResolvedValue(cv);
    mockFindByCodeAndVersion.mockResolvedValue(mockWorkflow);

    const result = await resolveAndFetchWorkflowUseCase(
      "pigs-might-fly",
      "1.0.0",
    );

    expect(result.workflow).toEqual(mockWorkflow);
    expect(result.resolvedVersion).toBe("1.0.0");
    expect(mockFetchConfigFile).not.toHaveBeenCalled();
  });

  it("should fetch from S3 when fetchStatus is pending", async () => {
    const cv = ConfigVersion.createMock({
      fetchStatus: FetchStatus.Pending,
    });
    mockFindLatestPatch.mockResolvedValue(cv);
    mockFindByCodeAndVersion.mockResolvedValue(null);
    mockFetchConfigFile.mockResolvedValue({ code: "pigs-might-fly" });
    mockSaveFromDefinition.mockResolvedValue(mockWorkflow);

    const result = await resolveAndFetchWorkflowUseCase(
      "pigs-might-fly",
      "1.0.0",
    );

    expect(result.workflow).toEqual(mockWorkflow);
    expect(mockFetchConfigFile).toHaveBeenCalled();
    expect(mockSaveFromDefinition).toHaveBeenCalled();
    expect(mockUpdateFetchStatus).toHaveBeenCalledWith(
      "pigs-might-fly",
      "1.0.0",
      FetchStatus.Fetched,
    );
  });

  it("should throw notFound when no config version exists", async () => {
    mockFindLatestPatch.mockResolvedValue(null);

    await expect(
      resolveAndFetchWorkflowUseCase("nonexistent", "1.0.0"),
    ).rejects.toThrow("No active config version found");
  });

  it("should throw badRequest for invalid semver", async () => {
    await expect(
      resolveAndFetchWorkflowUseCase("pigs-might-fly", "invalid"),
    ).rejects.toThrow("Invalid semver version");
  });

  it("should throw badGateway when fetchStatus is permanent_error", async () => {
    const cv = ConfigVersion.createMock({
      fetchStatus: FetchStatus.PermanentError,
      fetchError: "S3 object not found",
    });
    mockFindLatestPatch.mockResolvedValue(cv);

    await expect(
      resolveAndFetchWorkflowUseCase("pigs-might-fly", "1.0.0"),
    ).rejects.toThrow("Permanent error");
  });

  it("should escalate to permanent_error when max attempts exceeded", async () => {
    const cv = ConfigVersion.createMock({
      fetchStatus: FetchStatus.TransientError,
      fetchAttempts: 5,
    });
    mockFindLatestPatch.mockResolvedValue(cv);

    await expect(
      resolveAndFetchWorkflowUseCase("pigs-might-fly", "1.0.0"),
    ).rejects.toThrow("Max fetch attempts exceeded");

    expect(mockUpdateFetchStatus).toHaveBeenCalledWith(
      "pigs-might-fly",
      "1.0.0",
      FetchStatus.PermanentError,
      expect.stringContaining("Exceeded"),
    );
  });

  it("should resolve latest patch version", async () => {
    const cv = ConfigVersion.createMock({
      version: "1.0.3",
      patch: 3,
      fetchStatus: FetchStatus.Fetched,
    });
    mockFindLatestPatch.mockResolvedValue(cv);
    mockFindByCodeAndVersion.mockResolvedValue(mockWorkflow);

    const result = await resolveAndFetchWorkflowUseCase(
      "pigs-might-fly",
      "1.0.0",
    );

    expect(result.resolvedVersion).toBe("1.0.3");
  });
});
