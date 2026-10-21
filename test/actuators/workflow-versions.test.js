import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WorkflowDocument } from "../../src/cases/repositories/workflow/workflow-document.js";
import {
  fetchWorkflowDefinition,
  seedCaseReaderToken,
  viewWorkflowVersion,
  viewWorkflowVersions,
} from "../helpers/actuators.js";
import {
  aGrantCode,
  cwKey,
  putConfigFile,
  workflowDefinition,
} from "../helpers/config-broker.js";
import { seedConfigVersion } from "../helpers/config-versions.js";
import { SERVICE_TOKEN } from "../helpers/service-token.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../helpers/operator.js";

let client;
let db;
let workflows;
let configVersions;

// The compose service's .env configures RULES_ENGINE and
// TEST_EXTERNAL_SERVICE, each with headers; nothing configures LAND_DATA.
const ENDPOINTS = [
  {
    code: "land-parcels",
    service: "LAND_DATA",
    path: "/parcels/{sbi}",
    method: "GET",
  },
  {
    code: "rules-run",
    service: "RULES_ENGINE",
    path: "/case-management-adapter/application/validation-run/{runId}",
    method: "GET",
  },
  {
    code: "test-service",
    service: "TEST_EXTERNAL_SERVICE",
    path: "check",
    method: "POST",
  },
];

const storeWorkflow = async (code, version, overrides = {}) => {
  const document = WorkflowDocument.createMock({
    code,
    version,
    schemeName: "Woodland creation",
    requiredRoles: { allOf: ["ROLE_A"], anyOf: ["ROLE_B"] },
    endpoints: ENDPOINTS,
    ...overrides,
  });

  await workflows.insertOne(document);

  return document;
};

const bsonSizeOf = async (code, version) => {
  const [{ size }] = await workflows
    .aggregate([
      { $match: { code, version } },
      { $project: { size: { $bsonSize: "$$ROOT" } } },
    ])
    .toArray();

  return size;
};

const configVersionRow = (grantCode, version) =>
  configVersions.findOne({ grantCode, version });

const auditRows = (segregationRef) =>
  db.collection("outbox").find({ segregationRef }).toArray();

const errorBody = (error) => {
  const payload = error.data?.payload;

  return Buffer.isBuffer(payload) ? JSON.parse(payload.toString()) : payload;
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  workflows = db.collection("workflows");
  configVersions = db.collection("config_versions");
  await seedCaseReaderToken(db);
});

afterAll(async () => {
  await client?.close(true);
});

describe("GET /actuators/workflows/{code}/versions", () => {
  it("answers every version newest first by number, and the newest active one as current", async () => {
    const code = aGrantCode("woodland");
    await seedConfigVersion(db, code, "1.9.0");
    await seedConfigVersion(db, code, "1.10.0");
    await seedConfigVersion(db, code, "2.0.0", { status: "draft" });

    const { payload } = await viewWorkflowVersions(code);

    expect(payload.code).toBe(code);
    expect(payload.current).toBe("1.10.0");
    expect(payload.versions.map(({ version }) => version)).toEqual([
      "2.0.0",
      "1.10.0",
      "1.9.0",
    ]);
    expect(payload.versions[0]).toEqual({
      version: "2.0.0",
      status: "draft",
      receivedAt: expect.any(String),
    });
  });

  it("answers a null current version when none is active", async () => {
    const code = aGrantCode("woodland");
    await seedConfigVersion(db, code, "1.0.0", { status: "draft" });

    expect((await viewWorkflowVersions(code)).payload.current).toBeNull();
  });

  it("answers 404 with reason WORKFLOW_NOT_FOUND for a code with no versions", async () => {
    const error = await viewWorkflowVersions(aGrantCode("nope")).catch(
      (e) => e,
    );

    expect(error.output.statusCode).toBe(404);
    expect(errorBody(error)).toMatchObject({ reason: "WORKFLOW_NOT_FOUND" });
  });
});

describe("GET /actuators/workflows/{code}/versions/{version}", () => {
  it("answers a version that is not stored with nulls", async () => {
    const code = aGrantCode("woodland");
    await seedConfigVersion(db, code, "2.0.0", { status: "draft" });

    const { payload } = await viewWorkflowVersion(code, "2.0.0", {
      include: "document",
    });

    expect(payload).toMatchObject({
      version: {
        grantCode: code,
        version: "2.0.0",
        status: "draft",
        fetchStatus: "pending",
      },
      current: null,
      storedBytes: null,
      summary: null,
      document: null,
      addresses: [],
    });
  });

  it("answers a stored version's summary and size without its document", async () => {
    const code = aGrantCode("woodland");
    await seedConfigVersion(db, code, "1.0.0");
    await storeWorkflow(code, "1.0.0");

    const { payload } = await viewWorkflowVersion(code, "1.0.0");

    expect(payload.summary).toEqual({
      schemeName: "Woodland creation",
      requiredRoles: { allOf: ["ROLE_A"], anyOf: ["ROLE_B"] },
    });
    expect(payload.storedBytes).toBe(await bsonSizeOf(code, "1.0.0"));
    expect(payload).not.toHaveProperty("document");
    expect(payload).not.toHaveProperty("addresses");
  });

  it("answers the stored document exactly as stored, and each endpoint's address in order, never its headers", async () => {
    const code = aGrantCode("woodland");
    await seedConfigVersion(db, code, "1.0.0");
    await storeWorkflow(code, "1.0.0");
    const stored = await workflows.findOne({ code, version: "1.0.0" });

    const { payload } = await viewWorkflowVersion(code, "1.0.0", {
      include: "document",
    });

    expect(payload.document).toEqual(JSON.parse(JSON.stringify(stored)));
    expect(payload.document._id).toBe(stored._id.toHexString());
    expect(payload.document).not.toHaveProperty("storedBytes");
    expect(payload.addresses).toEqual([
      { code: "land-parcels", service: "LAND_DATA", url: null },
      {
        code: "rules-run",
        service: "RULES_ENGINE",
        url: "https://ephemeral-protected.api.dev.cdp-int.defra.cloud/land-grants-api/case-management-adapter/application/validation-run/{runId}",
      },
      {
        code: "test-service",
        service: "TEST_EXTERNAL_SERVICE",
        url: "http://host.docker.internal:5666/check",
      },
    ]);
    expect(JSON.stringify(payload)).not.toMatch(/x-api-key|Bearer/i);
  });

  it("reads a workflow stored under an upper-case code by that code", async () => {
    const code = aGrantCode("Casework-Smoke");
    await seedConfigVersion(db, code, "0.0.0");
    await storeWorkflow(code, "0.0.0");

    const { payload } = await viewWorkflowVersion(code, "0.0.0");

    expect(payload.version.grantCode).toBe(code);
    expect(payload.storedBytes).toBeGreaterThan(0);
  });

  it("answers 404 with reason WORKFLOW_VERSION_NOT_FOUND for an unknown version", async () => {
    const code = aGrantCode("woodland");
    await seedConfigVersion(db, code, "1.0.0");

    const error = await viewWorkflowVersion(code, "9.9.9").catch((e) => e);

    expect(error.output.statusCode).toBe(404);
    expect(errorBody(error)).toMatchObject({
      reason: "WORKFLOW_VERSION_NOT_FOUND",
    });
  });

  it("answers 403 to a client other than fg-gas-backend", async () => {
    await expect(
      viewWorkflowVersion("woodland", "1.0.0", undefined, {
        authorization: `Bearer ${SERVICE_TOKEN}`,
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });
});

describe("POST /actuators/workflows/{code}/versions/{version}/fetch", () => {
  const draftOf = async (code) => {
    await seedConfigVersion(db, code, "2.0.0", { status: "draft" });

    return configVersionRow(code, "2.0.0");
  };

  it("stores the definition, audits it for the operator, and leaves the config version record alone", async () => {
    const code = aGrantCode("woodland");
    const before = await draftOf(code);
    await putConfigFile(cwKey(code, "2.0.0"), workflowDefinition(code));

    const { payload } = await fetchWorkflowDefinition(code, "2.0.0", {
      by: OPERATOR_NAME,
    });

    expect(payload).toEqual({
      files: [{ file: "workflow", outcome: "stored" }],
    });
    expect(await workflows.findOne({ code, version: "2.0.0" })).toMatchObject({
      code,
      version: "2.0.0",
    });
    expect(await configVersionRow(code, "2.0.0")).toEqual(before);

    const rows = await auditRows(`fetch-definition-${code}`);

    expect(rows).toHaveLength(1);
    expect(rows[0].event).toMatchObject({
      user: OPERATOR_ID,
      security: { pmccode: "0706" },
      audit: {
        entities: [
          {
            entity: "WORKFLOW",
            action: "FETCH_CONFIG_DEFINITION",
            entityid: code,
          },
        ],
        status: "SUCCESS",
        details: {
          fetch: {
            grantCode: code,
            version: "2.0.0",
            actor: OPERATOR_NAME,
            files: [{ file: "workflow", outcome: "stored" }],
          },
        },
      },
    });
  });

  it("stores nothing when the file is missing, and leaves the record alone", async () => {
    const code = aGrantCode("woodland");
    const before = await draftOf(code);

    const { payload } = await fetchWorkflowDefinition(code, "2.0.0", {
      by: OPERATOR_NAME,
    });

    expect(payload).toEqual({
      files: [{ file: "workflow", outcome: "failed", reason: "missing" }],
    });
    expect(await workflows.findOne({ code })).toBeNull();
    expect(await configVersionRow(code, "2.0.0")).toEqual(before);
  });

  it("stores nothing for a definition the Workflow model refuses", async () => {
    const code = aGrantCode("woodland");
    await draftOf(code);
    await putConfigFile(cwKey(code, "2.0.0"), {
      ...workflowDefinition(code),
      phases: [],
    });

    const { payload } = await fetchWorkflowDefinition(code, "2.0.0", {
      by: OPERATOR_NAME,
    });

    expect(payload.files).toEqual([
      {
        file: "workflow",
        outcome: "failed",
        reason: "invalid",
        message: expect.stringContaining(`Invalid Workflow "${code}"`),
      },
    ]);
    expect(await workflows.findOne({ code })).toBeNull();
  });

  it("answers no files the second time", async () => {
    const code = aGrantCode("woodland");
    await draftOf(code);
    await putConfigFile(cwKey(code, "2.0.0"), workflowDefinition(code));

    await fetchWorkflowDefinition(code, "2.0.0", { by: OPERATOR_NAME });
    const { payload } = await fetchWorkflowDefinition(code, "2.0.0", {
      by: OPERATOR_NAME,
    });

    expect(payload).toEqual({ files: [] });
  });

  it("answers 400 without an operator, fetching nothing", async () => {
    const code = aGrantCode("woodland");
    await draftOf(code);

    await expect(fetchWorkflowDefinition(code, "2.0.0", {})).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
    expect(await auditRows(`fetch-definition-${code}`)).toEqual([]);
  });

  it("answers 404 with reason WORKFLOW_VERSION_NOT_FOUND for an unknown version", async () => {
    const error = await fetchWorkflowDefinition(aGrantCode("nope"), "1.0.0", {
      by: OPERATOR_NAME,
    }).catch((e) => e);

    expect(error.output.statusCode).toBe(404);
    expect(errorBody(error)).toMatchObject({
      reason: "WORKFLOW_VERSION_NOT_FOUND",
    });
  });
});
