import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findSeriesMembers,
  findStoredCase,
} from "../../cases/repositories/case.repository.js";
import { findByCaseRef } from "../../cases/repositories/case-series.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { logger } from "../../common/logger.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import {
  viewCaseDataAuditBuilder,
  viewCaseDataUseCase,
} from "./view-case-data.use-case.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";

vi.mock("../../cases/repositories/case.repository.js");
vi.mock("../../cases/repositories/case-series.repository.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const OPERATOR = { id: OPERATOR_ID, name: OPERATOR_NAME };
const ID = new ObjectId("665f1c2e9a1b2c3d4e5f6a7b");

const aStoredCase = (overrides = {}) => ({
  _id: ID,
  caseRef: "ref-2",
  workflowCode: "frps",
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW",
  currentStatus: "NEW",
  closed: true,
  closedAt: new Date("2026-06-20T00:00:00Z"),
  createdAt: new Date("2026-06-16T10:00:00Z"),
  originalConfigVersion: "1.0.0",
  currentConfigVersion: "1.2.0",
  storedBytes: 3600,
  ...overrides,
});

const SUMMARY = {
  ref: { caseRef: "ref-2", workflowCode: "frps" },
  position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
  closed: true,
  closedAt: "2026-06-20T00:00:00.000Z",
  createdAt: "2026-06-16T10:00:00.000Z",
  originalConfigVersion: "1.0.0",
  currentConfigVersion: "1.2.0",
  series: {
    latestRef: "ref-2",
    refs: ["ref-1", "ref-2"],
    members: [
      {
        caseRef: "ref-1",
        position: { phase: "PRE_AWARD", stage: "AWARD", status: "CLOSED" },
        createdAt: "2026-06-01T10:00:00.000Z",
        closedAt: "2026-06-10T00:00:00.000Z",
      },
      {
        caseRef: "ref-2",
        position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
        createdAt: "2026-06-16T10:00:00.000Z",
        closedAt: "2026-06-20T00:00:00.000Z",
      },
    ],
  },
};

const run = (include) =>
  viewCaseDataUseCase({
    workflowCode: "frps",
    caseRef: "ref-2",
    include,
    operator: OPERATOR,
    caller: CASE_READER_CLIENT,
  });

beforeEach(() => {
  withTransaction.mockImplementation((write) => write("the-session"));
  writeAuditEvent.mockResolvedValue(undefined);
  findStoredCase.mockResolvedValue(aStoredCase());
  findByCaseRef.mockResolvedValue([
    {
      workflowCode: "frps",
      caseRefs: ["ref-1", "ref-2"],
      latestCaseRef: "ref-2",
    },
  ]);
  // Unordered, as the read gives them.
  findSeriesMembers.mockResolvedValue([
    aStoredCase(),
    aStoredCase({
      caseRef: "ref-1",
      currentStage: "AWARD",
      currentStatus: "CLOSED",
      closedAt: new Date("2026-06-10T00:00:00Z"),
      createdAt: new Date("2026-06-01T10:00:00Z"),
    }),
  ]);
});

describe("viewCaseDataUseCase", () => {
  it("answers the summary and stored size with no include", async () => {
    expect(await run()).toEqual({ case: SUMMARY, storedBytes: 3600 });
    expect(findStoredCase).toHaveBeenCalledWith(
      { workflowCode: "frps", caseRef: "ref-2" },
      undefined,
    );
    expect(findByCaseRef).toHaveBeenCalledWith({
      ref: "ref-2",
      workflowCode: "frps",
    });
    expect(findSeriesMembers).toHaveBeenCalledWith({
      workflowCode: "frps",
      caseRefs: ["ref-1", "ref-2"],
    });
  });

  it("keeps a member whose case is missing in its place, with null facts", async () => {
    findByCaseRef.mockResolvedValue([
      {
        workflowCode: "frps",
        caseRefs: ["ref-0", "ref-1", "ref-2"],
        latestCaseRef: "ref-2",
      },
    ]);

    const { members } = (await run()).case.series;

    expect(members.map(({ caseRef }) => caseRef)).toEqual([
      "ref-0",
      "ref-1",
      "ref-2",
    ]);
    expect(members[0]).toEqual({
      caseRef: "ref-0",
      position: { phase: null, stage: null, status: null },
      createdAt: null,
      closedAt: null,
    });
  });

  it("reads no members for a series of one", async () => {
    findByCaseRef.mockResolvedValue([
      { workflowCode: "frps", caseRefs: ["ref-2"], latestCaseRef: "ref-2" },
    ]);

    expect((await run()).case.series).toEqual({
      latestRef: "ref-2",
      refs: ["ref-2"],
      members: [],
    });
    expect(findSeriesMembers).not.toHaveBeenCalled();
  });

  it("adds the stored document, with no computed field in it", async () => {
    const payload = { answers: { anything: [1, { deep: "x" }] } };
    findStoredCase.mockResolvedValue(aStoredCase({ payload }));

    const result = await run("document");

    expect(findStoredCase).toHaveBeenCalledWith(
      { workflowCode: "frps", caseRef: "ref-2" },
      "document",
    );
    expect(result.document).not.toHaveProperty("storedBytes");
    expect(result.document.payload).toEqual(payload);
    expect(result.storedBytes).toBe(3600);
  });

  it("answers a null series when the case is in none", async () => {
    findByCaseRef.mockResolvedValue([]);

    expect((await run()).case.series).toBeNull();
    expect(findSeriesMembers).not.toHaveBeenCalled();
  });

  it("answers 404 with reason CASE_NOT_FOUND and audits a FAILURE", async () => {
    findStoredCase.mockResolvedValue(null);

    await expect(run()).rejects.toMatchObject({
      output: {
        statusCode: 404,
        payload: { message: "Case not found", reason: "CASE_NOT_FOUND" },
      },
    });
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: auditStatus.FAILURE,
        entities: [
          { entity: "CASE", action: "VIEW_CASE_DATA", entityid: "ref-2" },
        ],
      }),
    );
  });

  it("logs the stored size and no ref", async () => {
    await run();

    expect(logger.info).toHaveBeenCalledWith("Read case document: 3600 bytes");
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("ref-2");
  });

  it("commits one VIEW_CASE_DATA row before answering", async () => {
    await run("document");

    expect(writeAuditEvent).toHaveBeenCalledTimes(1);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.SUCCESS }),
      "the-session",
    );
  });
});

describe("viewCaseDataAuditBuilder", () => {
  it.each([
    [undefined, "none"],
    ["document", "document"],
  ])("records include %s as %s", (include, recorded) => {
    expect(
      viewCaseDataAuditBuilder({
        workflowCode: "frps",
        caseRef: "ref-2",
        include,
        operator: OPERATOR,
        caller: CASE_READER_CLIENT,
      }),
    ).toEqual({
      entities: [
        { entity: "CASE", action: "VIEW_CASE_DATA", entityid: "ref-2" },
      ],
      details: {
        security: { actor: OPERATOR },
        caller: CASE_READER_CLIENT,
        workflowCode: "frps",
        include: recorded,
      },
      security: { pmccode: "0706" },
      segregationRef: "admin-view-case",
    });
  });
});
