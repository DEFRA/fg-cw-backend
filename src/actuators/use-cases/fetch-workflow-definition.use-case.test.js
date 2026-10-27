import Boom from "@hapi/boom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MongoServerError } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigVersion } from "../../cases/models/config-version.js";
import {
  findByGrantCodeAndVersion,
  updateFetchStatus,
  upsert,
} from "../../cases/repositories/config-version.repository.js";
import {
  findStoredVersions,
  saveFromDefinition,
} from "../../cases/repositories/workflow.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { fetchConfigFile, S3FetchError } from "../../common/s3-client.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import {
  fetchWorkflowDefinitionAuditBuilder,
  fetchWorkflowDefinitionUseCase,
} from "./fetch-workflow-definition.use-case.js";

vi.mock("../../cases/repositories/config-version.repository.js");
vi.mock("../../cases/repositories/workflow.repository.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../common/s3-client.js", async (importOriginal) => ({
  ...(await importOriginal()),
  fetchConfigFile: vi.fn(),
}));
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const DEFINITION = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      "../../../test/fixtures/workflow-definitions/pigs-might-fly.cw.json",
    ),
    "utf8",
  ),
);

const fetch = (grantCode = "pigs-might-fly") =>
  fetchWorkflowDefinitionUseCase({
    grantCode,
    version: "2.0.0",
    by: "Example Assignee",
    caller: "fg-gas-backend",
  });

const aRow = (grantCode) =>
  ConfigVersion.createMock({
    grantCode,
    version: "2.0.0",
    s3Bucket: "config-broker-local",
    s3Key: `${grantCode}/2.0.0/cw/cw.json`,
  });

const s3Error = (code, statusCode) =>
  new S3FetchError("S3 said no", { code, statusCode });

beforeEach(() => {
  writeAuditEvent.mockResolvedValue(undefined);
  findByGrantCodeAndVersion.mockResolvedValue(aRow("pigs-might-fly"));
  findStoredVersions.mockResolvedValue(new Set());
  fetchConfigFile.mockResolvedValue(DEFINITION);
  saveFromDefinition.mockResolvedValue({});
});

describe("fetchWorkflowDefinitionUseCase", () => {
  it("stores a definition the Workflow model accepts", async () => {
    expect(await fetch()).toEqual({
      files: [{ file: "workflow", outcome: "stored" }],
    });
    expect(fetchConfigFile).toHaveBeenCalledWith(
      "config-broker-local",
      "pigs-might-fly/2.0.0/cw/cw.json",
    );
    expect(saveFromDefinition).toHaveBeenCalledWith(DEFINITION, "2.0.0");
  });

  it("answers no files, and reads nothing from S3, when the workflow is already stored", async () => {
    findStoredVersions.mockResolvedValue(new Set(["2.0.0"]));

    expect(await fetch()).toEqual({ files: [] });
    expect(findStoredVersions).toHaveBeenCalledWith("pigs-might-fly", [
      "2.0.0",
    ]);
    expect(fetchConfigFile).not.toHaveBeenCalled();
  });

  it("counts a duplicate key as stored when the version is now stored", async () => {
    findStoredVersions
      .mockResolvedValueOnce(new Set())
      .mockResolvedValueOnce(new Set(["2.0.0"]));
    saveFromDefinition.mockRejectedValue(Boom.conflict("already exists"));

    expect(await fetch()).toEqual({
      files: [{ file: "workflow", outcome: "stored" }],
    });
  });

  it("gives a duplicate key as invalid when the version is still not stored", async () => {
    saveFromDefinition.mockRejectedValue(Boom.conflict("already exists"));

    expect(await fetch()).toEqual({
      files: [
        {
          file: "workflow",
          outcome: "failed",
          reason: "invalid",
          message: "already exists",
        },
      ],
    });
  });

  it.each([
    ["NoSuchKey", 404, "missing"],
    ["AccessDenied", 403, "forbidden"],
    ["PARSE_ERROR", 200, "unparseable"],
    ["SERVICE_ERROR", 500, "timeout"],
  ])("gives S3's %s as %s and stores nothing", async (code, status, reason) => {
    fetchConfigFile.mockRejectedValue(s3Error(code, status));

    expect(await fetch()).toEqual({
      files: [{ file: "workflow", outcome: "failed", reason }],
    });
    expect(saveFromDefinition).not.toHaveBeenCalled();
  });

  it("gives a version with no S3 location as missing", async () => {
    findByGrantCodeAndVersion.mockResolvedValue(
      ConfigVersion.createMock({ s3Key: null, s3Bucket: null }),
    );

    expect(await fetch()).toEqual({
      files: [{ file: "workflow", outcome: "failed", reason: "missing" }],
    });
    expect(fetchConfigFile).not.toHaveBeenCalled();
  });

  it("gives a definition the Workflow model refuses as invalid, with its message", async () => {
    fetchConfigFile.mockResolvedValue({ ...DEFINITION, phases: [] });

    expect(await fetch()).toEqual({
      files: [
        {
          file: "workflow",
          outcome: "failed",
          reason: "invalid",
          message:
            'Invalid Workflow "pigs-might-fly": it has no initial position, its first phase needs a stage with a status',
        },
      ],
    });
    expect(saveFromDefinition).not.toHaveBeenCalled();
  });

  it("cuts an invalid definition's message to 500 characters", async () => {
    fetchConfigFile.mockResolvedValue({
      ...DEFINITION,
      code: "not_a_code".repeat(60),
    });

    const [file] = (await fetch()).files;

    expect(file.message).toHaveLength(500);
  });

  // As farm-payments publishes its alias's cw.json. Stored, it would be another
  // workflow, so this version would stay without one.
  it("refuses a definition for another code as invalid, storing nothing", async () => {
    findByGrantCodeAndVersion.mockResolvedValue(aRow("farm-payments"));

    expect(await fetch("farm-payments")).toEqual({
      files: [
        {
          file: "workflow",
          outcome: "failed",
          reason: "invalid",
          message: 'Definition is for "pigs-might-fly", not "farm-payments"',
        },
      ],
    });
    expect(saveFromDefinition).not.toHaveBeenCalled();
  });

  it.each([
    ["no code", { ...DEFINITION, code: undefined }],
    ["an array", [DEFINITION]],
  ])(
    "leaves a definition with %s to the Workflow model's refusal",
    async (_, definition) => {
      fetchConfigFile.mockResolvedValue(definition);

      const [file] = (await fetch()).files;

      expect(file).toMatchObject({ outcome: "failed", reason: "invalid" });
      expect(file.message).not.toContain("Definition is for");
      expect(saveFromDefinition).not.toHaveBeenCalled();
    },
  );

  it("rethrows a database failure and audits it as a FAILURE", async () => {
    const error = new MongoServerError({ message: "not primary" });
    saveFromDefinition.mockRejectedValue(error);

    await expect(fetch()).rejects.toBe(error);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
  });

  it("answers 404 with reason WORKFLOW_VERSION_NOT_FOUND for an unknown version", async () => {
    findByGrantCodeAndVersion.mockResolvedValue(null);

    await expect(fetch()).rejects.toMatchObject({
      output: {
        statusCode: 404,
        payload: { reason: "WORKFLOW_VERSION_NOT_FOUND" },
      },
    });
  });

  it.each([
    ["stores", () => {}],
    [
      "fails",
      () => fetchConfigFile.mockRejectedValue(s3Error("NoSuchKey", 404)),
    ],
    [
      "finds it stored",
      () => findStoredVersions.mockResolvedValue(new Set(["2.0.0"])),
    ],
  ])("never writes the config version record when it %s", async (_, given) => {
    given();

    await fetch();

    expect(updateFetchStatus).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("audits a SUCCESS naming the operator and each file's outcome", async () => {
    await fetch();

    expect(writeAuditEvent).toHaveBeenCalledWith(
      {
        entities: [
          {
            entity: "WORKFLOW",
            action: "FETCH_CONFIG_DEFINITION",
            entityid: "pigs-might-fly",
          },
        ],
        accounts: undefined,
        details: {
          security: {
            actor: { id: "fg-gas-backend", name: "GAS (system)" },
          },
          fetch: {
            grantCode: "pigs-might-fly",
            version: "2.0.0",
            actor: "Example Assignee",
            caller: "fg-gas-backend",
            files: [{ file: "workflow", outcome: "stored" }],
          },
        },
        security: { pmccode: "0706" },
        segregationRef: "fetch-definition-pigs-might-fly",
        status: auditStatus.SUCCESS,
      },
      undefined,
    );
  });
});

describe("fetchWorkflowDefinitionAuditBuilder", () => {
  it("records no files for a fetch that threw", () => {
    expect(
      fetchWorkflowDefinitionAuditBuilder(
        [
          {
            grantCode: "pigs-might-fly",
            version: "2.0.0",
            by: "Example Assignee",
          },
        ],
        undefined,
      ).details.fetch,
    ).toEqual({
      grantCode: "pigs-might-fly",
      version: "2.0.0",
      actor: "Example Assignee",
      caller: null,
      files: null,
    });
  });
});
