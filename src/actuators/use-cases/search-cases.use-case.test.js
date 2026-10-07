import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  countCaseList,
  findCaseListBySeries,
  findCaseListPage,
} from "../../cases/repositories/case.repository.js";
import {
  findByCaseRef,
  findSeriesContaining,
} from "../../cases/repositories/case-series.repository.js";
import { findAllCodes } from "../../cases/repositories/workflow.repository.js";
import { auditStatus } from "../../common/audit-constants.js";
import { logger } from "../../common/logger.js";
import { withTransaction } from "../../common/with-transaction.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import {
  searchCasesAuditBuilder,
  searchCasesUseCase,
} from "./search-cases.use-case.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { CASE_READER_CLIENT } from "../../common/require-case-reader.js";

vi.mock("../../cases/repositories/case.repository.js");
vi.mock("../../cases/repositories/case-series.repository.js");
vi.mock("../../cases/repositories/workflow.repository.js");
vi.mock("../../common/with-transaction.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const OPERATOR = { id: OPERATOR_ID, name: OPERATOR_NAME };

const aDoc = (caseRef, createdAt, id = new ObjectId()) => ({
  _id: id,
  caseRef,
  workflowCode: "frps",
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW",
  currentStatus: "NEW",
  closed: false,
  closedAt: null,
  createdAt: new Date(createdAt),
});

const run = (query, extra = {}) =>
  searchCasesUseCase({
    query,
    operator: OPERATOR,
    caller: CASE_READER_CLIENT,
    repeat: false,
    ...extra,
  });

beforeEach(() => {
  withTransaction.mockImplementation((write) => write("the-session"));
  writeAuditEvent.mockResolvedValue(undefined);
  findAllCodes.mockResolvedValue(["frps", "woodland"]);
  findCaseListPage.mockResolvedValue({
    data: [aDoc("ref-2", "2026-06-16T10:00:00Z")],
    pagination: { endCursor: "next", hasNextPage: true, startCursor: "x" },
  });
  countCaseList.mockResolvedValue(57);
  findByCaseRef.mockResolvedValue([]);
  findSeriesContaining.mockResolvedValue([]);
  findCaseListBySeries.mockResolvedValue([]);
});

describe("searchCasesUseCase, browse", () => {
  it("answers a page of rows with its cursor, a total and the codes", async () => {
    const result = await run({ workflowCode: "frps" });

    expect(findCaseListPage).toHaveBeenCalledWith({ workflowCode: "frps" });
    expect(findAllCodes).toHaveBeenCalledWith({}, { maxTimeMS: 3000 });
    expect(result).toEqual({
      cases: [
        {
          ref: { caseRef: "ref-2", workflowCode: "frps" },
          position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
          closed: false,
          closedAt: null,
          createdAt: "2026-06-16T10:00:00.000Z",
          replaced: false,
        },
      ],
      pagination: { endCursor: "next", hasNextPage: true },
      total: { count: 57, capped: false },
      workflowCodes: ["frps", "woodland"],
    });
  });

  it("marks each row replaced from one series read for the page", async () => {
    findCaseListPage.mockResolvedValue({
      data: [
        aDoc("ref-2", "2026-06-16T10:00:00Z"),
        aDoc("ref-1", "2026-06-15T10:00:00Z"),
        { ...aDoc("ref-1", "2026-06-14T10:00:00Z"), workflowCode: "woodland" },
        aDoc("loner", "2026-06-13T10:00:00Z"),
      ],
      pagination: { endCursor: null, hasNextPage: false },
    });
    findSeriesContaining.mockResolvedValue([
      {
        workflowCode: "frps",
        caseRefs: ["ref-1", "ref-2"],
        latestCaseRef: "ref-2",
      },
    ]);

    const result = await run({});

    expect(findSeriesContaining).toHaveBeenCalledTimes(1);
    expect(findSeriesContaining).toHaveBeenCalledWith({
      caseRefs: ["ref-2", "ref-1", "loner"],
    });
    expect(
      result.cases.map(({ ref, replaced }) => [
        `${ref.workflowCode}/${ref.caseRef}`,
        replaced,
      ]),
    ).toEqual([
      ["frps/ref-2", false],
      ["frps/ref-1", true],
      ["woodland/ref-1", false],
      ["frps/loner", false],
    ]);
  });

  it("reads no series for an empty page or a row with no ref", async () => {
    findCaseListPage.mockResolvedValue({
      data: [],
      pagination: { endCursor: null, hasNextPage: false },
    });

    expect((await run({})).cases).toEqual([]);

    findCaseListPage.mockResolvedValue({
      data: [{ _id: new ObjectId() }],
      pagination: { endCursor: null, hasNextPage: false },
    });

    expect((await run({})).cases[0].replaced).toBe(false);
    expect(findSeriesContaining).not.toHaveBeenCalled();
  });

  it("caps the total at 10,000", async () => {
    countCaseList.mockResolvedValue(10_001);

    const result = await run({});

    expect(countCaseList).toHaveBeenCalledWith({}, 10_001);
    expect(result.total).toEqual({ count: 10_000, capped: true });
  });

  it("gives no total or codes on a cursor page", async () => {
    const result = await run({ cursor: "next" });

    expect(result.total).toBeUndefined();
    expect(result.workflowCodes).toBeUndefined();
    expect(countCaseList).not.toHaveBeenCalled();
    expect(findAllCodes).not.toHaveBeenCalled();
  });

  it("leaves the total off when asked to", async () => {
    const result = await run({ withTotal: false });

    expect(result.total).toBeUndefined();
    expect(countCaseList).not.toHaveBeenCalled();
    expect(result.workflowCodes).toEqual(["frps", "woodland"]);
  });
});

describe("searchCasesUseCase, ref search", () => {
  it("reads the series, then every member, newest first on one page", async () => {
    const older = aDoc("ref-1", "2026-06-01T00:00:00Z");
    const newer = aDoc("ref-3", "2026-06-03T00:00:00Z");
    const middle = aDoc("ref-2", "2026-06-02T00:00:00Z");
    const series = [
      { workflowCode: "frps", caseRefs: ["ref-1", "ref-2", "ref-3"] },
    ];
    findByCaseRef.mockResolvedValue(series);
    findCaseListBySeries.mockResolvedValue([older, newer, middle]);

    const result = await run({ ref: "ref-2", from: "2026-01-01T00:00:00Z" });

    expect(findByCaseRef).toHaveBeenCalledWith({
      ref: "ref-2",
      from: "2026-01-01T00:00:00Z",
    });
    expect(findCaseListBySeries).toHaveBeenCalledWith(
      { ref: "ref-2", from: "2026-01-01T00:00:00Z", series },
      201,
    );
    expect(result.cases.map(({ ref }) => ref.caseRef)).toEqual([
      "ref-3",
      "ref-2",
      "ref-1",
    ]);
    expect(result.pagination).toEqual({ endCursor: null, hasNextPage: false });
    expect(result.total).toEqual({ count: 3, capped: false });
    expect(findCaseListPage).not.toHaveBeenCalled();
    expect(countCaseList).not.toHaveBeenCalled();
  });

  it("marks the members the latest replaced, from one series read for the page", async () => {
    findCaseListBySeries.mockResolvedValue([
      aDoc("ref-1", "2026-06-01T00:00:00Z"),
      aDoc("ref-2", "2026-06-02T00:00:00Z"),
    ]);
    findSeriesContaining.mockResolvedValue([
      {
        workflowCode: "frps",
        caseRefs: ["ref-1", "ref-2"],
        latestCaseRef: "ref-2",
      },
    ]);

    const result = await run({ ref: "ref-1" });

    expect(findSeriesContaining).toHaveBeenCalledWith({
      caseRefs: ["ref-2", "ref-1"],
    });
    expect(
      result.cases.map(({ ref, replaced }) => [ref.caseRef, replaced]),
    ).toEqual([
      ["ref-2", false],
      ["ref-1", true],
    ]);
  });

  it("breaks a createdAt tie by _id, highest first", async () => {
    const low = aDoc(
      "ref-a",
      "2026-06-01T00:00:00Z",
      new ObjectId("000000000000000000000001"),
    );
    const high = aDoc(
      "ref-b",
      "2026-06-01T00:00:00Z",
      new ObjectId("000000000000000000000002"),
    );
    findCaseListBySeries.mockResolvedValue([low, high]);

    const result = await run({ ref: "ref-a" });

    expect(result.cases.map(({ ref }) => ref.caseRef)).toEqual([
      "ref-b",
      "ref-a",
    ]);
  });

  it("returns at most 200 and says the total is capped past that", async () => {
    findCaseListBySeries.mockResolvedValue(
      Array.from({ length: 201 }, (_, i) =>
        aDoc(`ref-${i}`, new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString()),
      ),
    );

    const result = await run({ ref: "ref-1" });

    expect(result.cases).toHaveLength(200);
    expect(result.total).toEqual({ count: 200, capped: true });
    expect(findSeriesContaining.mock.calls[0][0].caseRefs).toHaveLength(200);
  });
});

describe("searchCasesUseCase, audit", () => {
  it("logs the mode, never the ref or the operator", async () => {
    await run({ ref: "secret-ref" });

    const logged = JSON.stringify(logger.info.mock.calls);

    expect(logged).toContain("search");
    expect(logged).not.toContain("secret-ref");
    expect(logged).not.toContain(OPERATOR_NAME);
    expect(logged).not.toContain(OPERATOR_ID);
  });

  it("commits one FIND_CASES row before answering", async () => {
    await run({ workflowCode: "frps" }, { repeat: true });

    expect(writeAuditEvent).toHaveBeenCalledTimes(1);
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        status: auditStatus.SUCCESS,
        segregationRef: "admin-search-cases",
        security: { pmccode: "0706" },
        details: expect.objectContaining({
          mode: "browse",
          page: "first",
          resultCount: 1,
          total: { count: 57, capped: false },
          repeat: true,
        }),
      }),
      "the-session",
    );
  });

  it("writes a FAILURE when the read fails", async () => {
    findCaseListPage.mockRejectedValue(new Error("timed out"));

    await expect(run({})).rejects.toThrow("timed out");
    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
    );
  });
});

describe("searchCasesAuditBuilder", () => {
  it("records the operator, the caller and the query, without the ref", () => {
    const audit = searchCasesAuditBuilder(
      {
        query: {
          ref: "ref-1",
          workflowCode: "frps",
          from: "2026-06-01T00:00:00Z",
          to: "2026-06-30T00:00:00Z",
        },
        operator: OPERATOR,
        caller: CASE_READER_CLIENT,
        repeat: false,
      },
      { cases: [{}, {}], total: { count: 2, capped: false } },
    );

    expect(audit).toEqual({
      entities: [{ entity: "CASE", action: "FIND_CASES", entityid: "search" }],
      details: {
        security: { actor: OPERATOR },
        caller: CASE_READER_CLIENT,
        mode: "search",
        workflowCode: "frps",
        from: "2026-06-01T00:00:00Z",
        to: "2026-06-30T00:00:00Z",
        page: "first",
        resultCount: 2,
        total: { count: 2, capped: false },
        repeat: false,
      },
      security: { pmccode: "0706" },
      segregationRef: "admin-search-cases",
    });
  });

  it("marks a cursor page as the next page, with no result on a failure", () => {
    const { details } = searchCasesAuditBuilder(
      {
        query: { cursor: "c" },
        operator: OPERATOR,
        caller: "x",
        repeat: false,
      },
      null,
    );

    expect(details).toMatchObject({ mode: "browse", page: "next" });
    expect(details.resultCount).toBeUndefined();
    expect(details.total).toBeUndefined();
  });
});
