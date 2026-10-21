import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigVersion } from "../../cases/models/config-version.js";
import {
  findAllForCode,
  findCurrent,
} from "../../cases/repositories/config-version.repository.js";
import { findStoredWorkflowRow } from "../../cases/repositories/workflow.repository.js";
import { FetchStatus } from "../../common/fetch-status.js";
import { viewWorkflowVersionUseCase } from "./view-workflow-version.use-case.js";

vi.mock("../../cases/repositories/config-version.repository.js");
vi.mock("../../cases/repositories/workflow.repository.js");

const ID = new ObjectId("665f1c2e9a1b2c3d4e5f6a7b");
const RECEIVED_AT = "2026-10-15T10:04:00.000Z";

const aRow = (version, overrides = {}) =>
  ConfigVersion.createMock({
    grantCode: "woodland",
    version,
    receivedAt: RECEIVED_AT,
    ...overrides,
  });

const ENDPOINTS = [
  {
    code: "land-parcels",
    service: "LAND_DATA",
    path: "/parcels/{sbi}",
    method: "GET",
  },
  { code: "rules", service: "RULES", path: "/run", method: "POST" },
];

const aStoredWorkflow = (overrides = {}) => ({
  _id: ID,
  code: "woodland",
  schemeName: "Woodland creation",
  version: "2.0.0",
  requiredRoles: { allOf: ["ROLE_A"], anyOf: [] },
  endpoints: ENDPOINTS,
  storedBytes: 5120,
  ...overrides,
});

const read = (include, version = "2.0.0") =>
  viewWorkflowVersionUseCase({ code: "woodland", version, include });

const originalEnv = process.env;

beforeEach(() => {
  process.env = {
    ...originalEnv,
    LAND_DATA_URL: "https://land.example/api/",
    LAND_DATA_HEADERS: "x-api-key: HEADER_SENTINEL",
    RULES_URL: undefined,
  };
  findAllForCode.mockResolvedValue([
    aRow("2.0.0", { status: "draft", fetchStatus: FetchStatus.Pending }),
    aRow("1.2.0"),
  ]);
  findCurrent.mockResolvedValue(aRow("1.2.0"));
  findStoredWorkflowRow.mockResolvedValue(aStoredWorkflow());
});

afterEach(() => {
  process.env = originalEnv;
});

describe("viewWorkflowVersionUseCase", () => {
  it("answers the version's row, every version, the current one and the stored summary", async () => {
    expect(await read()).toEqual({
      version: {
        grantCode: "woodland",
        version: "2.0.0",
        status: "draft",
        receivedAt: RECEIVED_AT,
        fetchStatus: "pending",
      },
      versions: [
        { version: "2.0.0", status: "draft", receivedAt: RECEIVED_AT },
        { version: "1.2.0", status: "active", receivedAt: RECEIVED_AT },
      ],
      current: "1.2.0",
      storedBytes: 5120,
      summary: {
        schemeName: "Woodland creation",
        requiredRoles: { allOf: ["ROLE_A"], anyOf: [] },
      },
    });
    expect(findStoredWorkflowRow).toHaveBeenCalledWith(
      { code: "woodland", version: "2.0.0" },
      undefined,
    );
  });

  it("answers nulls for a version whose workflow is not stored", async () => {
    findStoredWorkflowRow.mockResolvedValue(null);

    expect(await read("document")).toMatchObject({
      storedBytes: null,
      summary: null,
      document: null,
      addresses: [],
    });
  });

  it("adds the stored document, with no computed field in it", async () => {
    const result = await read("document");

    expect(findStoredWorkflowRow).toHaveBeenCalledWith(
      { code: "woodland", version: "2.0.0" },
      "document",
    );
    expect(result.document).not.toHaveProperty("storedBytes");
    expect(result.document).toMatchObject({ _id: ID, endpoints: ENDPOINTS });
  });

  it("adds one address per endpoint in the workflow's order, never its headers", async () => {
    const result = await read("document");

    expect(result.addresses).toEqual([
      {
        code: "land-parcels",
        service: "LAND_DATA",
        url: "https://land.example/api/parcels/{sbi}",
      },
      { code: "rules", service: "RULES", url: null },
    ]);
    expect(JSON.stringify(result)).not.toContain("HEADER_SENTINEL");
  });

  it("adds no addresses for a workflow stored without endpoints", async () => {
    findStoredWorkflowRow.mockResolvedValue(
      aStoredWorkflow({ endpoints: undefined }),
    );

    expect((await read("document")).addresses).toEqual([]);
  });

  it("answers 404 with reason WORKFLOW_VERSION_NOT_FOUND for an unknown version", async () => {
    await expect(read(undefined, "9.9.9")).rejects.toMatchObject({
      output: {
        statusCode: 404,
        payload: { reason: "WORKFLOW_VERSION_NOT_FOUND" },
      },
    });
  });
});
