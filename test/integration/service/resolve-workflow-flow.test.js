import { MongoClient } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ConfigVersion } from "../../../src/cases/models/config-version.js";
import { Workflow } from "../../../src/cases/models/workflow.js";
import { upsert } from "../../../src/cases/repositories/config-version.repository.js";
import { resolveAndFetchWorkflowUseCase } from "../../../src/cases/use-cases/resolve-and-fetch-workflow.use-case.js";
import { FetchStatus } from "../../../src/common/fetch-status.js";

vi.mock("../../../src/common/s3-client.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    fetchConfigFile: vi.fn(),
  };
});

const { fetchConfigFile } = await import("../../../src/common/s3-client.js");

let client;
let configVersionsCol, workflowsCol;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  const db = client.db();
  configVersionsCol = db.collection("config_versions");
  workflowsCol = db.collection("workflows");
});

beforeEach(async () => {
  await configVersionsCol.deleteMany({});
  await workflowsCol.deleteMany({ code: "pigs-might-fly" });
});

afterEach(async () => {
  vi.restoreAllMocks();
  await configVersionsCol.deleteMany({});
  await workflowsCol.deleteMany({ code: "pigs-might-fly" });
});

afterAll(async () => {
  await client?.close();
});

describe("resolve-and-fetch-workflow integration", () => {
  it("should resolve config version, fetch from S3, and save workflow", async () => {
    const cv = ConfigVersion.createMock({
      grantCode: "pigs-might-fly",
      version: "1.0.0",
      major: 1,
      minor: 0,
      patch: 0,
      status: "active",
      fetchStatus: FetchStatus.Pending,
    });
    await upsert(cv);

    const mockWorkflowDef = Workflow.createMock({ code: "pigs-might-fly" });
    fetchConfigFile.mockResolvedValue(mockWorkflowDef);

    const result = await resolveAndFetchWorkflowUseCase(
      "pigs-might-fly",
      "1.0.0",
    );

    expect(result.resolvedVersion).toBe("1.0.0");
    expect(result.workflow.code).toBe("pigs-might-fly");
    expect(result.workflow.version).toBe("1.0.0");

    const savedWorkflow = await workflowsCol.findOne({
      code: "pigs-might-fly",
      version: "1.0.0",
    });
    expect(savedWorkflow).not.toBeNull();

    const cvDoc = await configVersionsCol.findOne({
      grantCode: "pigs-might-fly",
      version: "1.0.0",
    });
    expect(cvDoc.fetchStatus).toBe(FetchStatus.Fetched);
    expect(cvDoc.fetchedAt).toBeTruthy();
  });

  it("should return cached workflow without fetching from S3 on second call", async () => {
    const cv = ConfigVersion.createMock({
      grantCode: "pigs-might-fly",
      version: "1.0.0",
      major: 1,
      minor: 0,
      patch: 0,
      status: "active",
      fetchStatus: FetchStatus.Pending,
    });
    await upsert(cv);

    const mockWorkflowDef = Workflow.createMock({ code: "pigs-might-fly" });
    fetchConfigFile.mockResolvedValue(mockWorkflowDef);

    await resolveAndFetchWorkflowUseCase("pigs-might-fly", "1.0.0");
    fetchConfigFile.mockClear();

    const result = await resolveAndFetchWorkflowUseCase(
      "pigs-might-fly",
      "1.0.0",
    );

    expect(fetchConfigFile).not.toHaveBeenCalled();
    expect(result.workflow.code).toBe("pigs-might-fly");
    expect(result.resolvedVersion).toBe("1.0.0");
  });

  it("should resolve to latest patch version", async () => {
    await upsert(
      ConfigVersion.createMock({
        grantCode: "pigs-might-fly",
        version: "1.0.0",
        major: 1,
        minor: 0,
        patch: 0,
        status: "active",
        fetchStatus: FetchStatus.Pending,
      }),
    );
    await upsert(
      ConfigVersion.createMock({
        grantCode: "pigs-might-fly",
        version: "1.0.3",
        major: 1,
        minor: 0,
        patch: 3,
        status: "active",
        fetchStatus: FetchStatus.Pending,
      }),
    );

    const mockWorkflowDef = Workflow.createMock({ code: "pigs-might-fly" });
    fetchConfigFile.mockResolvedValue(mockWorkflowDef);

    const result = await resolveAndFetchWorkflowUseCase(
      "pigs-might-fly",
      "1.0.0",
    );

    expect(result.resolvedVersion).toBe("1.0.3");
  });

  it("should throw notFound when no config version exists", async () => {
    await expect(
      resolveAndFetchWorkflowUseCase("pigs-might-fly", "9.0.0"),
    ).rejects.toThrow(/No active config version found/);
  });
});
