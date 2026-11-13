import { setTimeout } from "node:timers/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { casesSource } from "../../cases/explore/cases.source.js";
import { workflowsSource } from "../../cases/explore/workflows.source.js";
import { findNewestWorkflows } from "../../cases/repositories/workflow.repository.js";
import { config } from "../../common/config.js";
import {
  clearExploreSources,
  registerExploreSource,
} from "../../common/explore-sources/registry.js";
import { valueDigest } from "../../common/explore/digest.js";
import { refuseQuery } from "../../common/explore/refusal.js";
import { runPart } from "../../common/explore/run.js";
import { logger } from "../../common/logger.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { eventsSource } from "../../events/explore/events.source.js";
import { forgetAnswerList } from "./load-answer-list.use-case.js";
import { exploreQueryUseCase } from "./explore-query.use-case.js";

vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../common/explore/run.js");
vi.mock("../../cases/repositories/workflow.repository.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../common/with-transaction.js", () => ({
  withTransaction: (work) => work({ session: true }),
}));

const SENTINEL = "Sentinel Farm 4417";
const KEY = "k".repeat(32);
const OPERATOR = { id: OPERATOR_ID, name: OPERATOR_NAME };

const BUSINESS = "payload.answers.applicant.business.name";

const query = (overrides = {}) => ({
  v: 2,
  source: "cases",
  mode: "rows",
  columns: [{ path: "caseRef" }, { path: BUSINESS }],
  where: {
    all: [
      { path: "workflowCode", op: "eq", values: ["w"] },
      {
        path: BUSINESS,
        op: "regex",
        values: [{ pattern: SENTINEL, flags: "i" }],
      },
    ],
  },
  unwind: [],
  groupBy: null,
  orderBy: null,
  limit: 50,
  positions: null,
  ...overrides,
});

const PART = {
  read: "windowed",
  groups: null,
  boxes: [{ id: "cw.cases", rows: [{}, {}], to: null, end: true, count: null }],
};

const ask = (asked = query(), timeLeftMs = 5000) =>
  exploreQueryUseCase({
    query: asked,
    operator: OPERATOR,
    caller: "fg-gas-backend",
    timeLeftMs,
  });

const failure = (promise) => promise.catch((error) => error);

const audits = () => writeAuditEvent.mock.calls.map(([event]) => event);

const WORKFLOW = {
  code: "woodland",
  pages: { title: { text: "$.payload.answers.woodlandName" } },
};

beforeEach(() => {
  clearExploreSources();
  [casesSource, workflowsSource, eventsSource].forEach(registerExploreSource);
  forgetAnswerList();
  findNewestWorkflows.mockResolvedValue([WORKFLOW]);
  vi.spyOn(config, "get").mockImplementation((key) =>
    key === "searchAuditKey" ? KEY : undefined,
  );
  writeAuditEvent.mockResolvedValue();
});

describe("exploreQueryUseCase", () => {
  it("audits a part that skipped a record too large to search as partial, with the count", async () => {
    runPart.mockResolvedValue({
      ...PART,
      boxes: [
        {
          id: "cw.cases",
          rows: [],
          to: { t: "2026-10-13T10:00:00.000Z", i: "6650c1e2a1b2c3d4e5f60718" },
          end: false,
          count: null,
          partial: true,
          skipped: 1,
        },
      ],
    });

    await ask();

    expect(audits()[0].details).toMatchObject({
      outcome: "PARTIAL",
      skipped: 1,
    });
  });

  it("reads its source and audits its part, each value only as a digest", async () => {
    runPart.mockResolvedValue(PART);

    expect(await ask()).toEqual(PART);
    expect(runPart.mock.calls[0][0].name).toBe("cases");

    const [event] = audits();

    expect(event).toMatchObject({
      status: "success",
      entities: [
        {
          entity: "EXPLORE_SOURCE",
          action: "EXPLORE_QUERY",
          entityid: "cases",
        },
      ],
      details: {
        caller: "fg-gas-backend",
        source: "cases",
        read: "windowed",
        shape:
          "db.cases.find({ $and: [{ workflowCode: ? }, { 'payload.answers.applicant.business.name': /?/ }] }, { caseRef: 1, 'payload.answers.applicant.business.name': 1 }).limit(?)",
        conditions: [
          {
            path: "workflowCode",
            op: "eq",
            digests: [valueDigest(KEY, 'workflowCode:"w"')],
          },
          {
            path: BUSINESS,
            op: "regex",
            digests: [valueDigest(KEY, `${BUSINESS}:/${SENTINEL}/i`)],
          },
        ],
        window: "first",
        resultCount: 2,
        outcome: "ANSWERED",
      },
      security: { pmccode: "0706" },
    });
    expect(JSON.stringify(event)).not.toContain("entinel");
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("entinel");
  });

  it.each([
    ["a source it doesn't have", query({ source: "applications" })],
    [
      "too many conditions",
      query({
        where: {
          all: Array.from({ length: 31 }, () => ({
            path: "caseRef",
            op: "filled",
            values: [],
          })),
        },
      }),
    ],
    [
      "a group without its path's column",
      query({
        mode: "groups",
        columns: [{ path: "caseRef" }],
        groupBy: { path: "currentStatus" },
      }),
    ],
    [
      "a position of another source's box",
      query({ positions: { "gas.applications": null } }),
    ],
  ])("refuses %s before reading, writing no audit", async (_, asked) => {
    const error = await failure(ask(asked));

    expect(error.output.payload).toEqual({
      statusCode: 400,
      reason: "EXPLORE_QUERY_INVALID",
    });
    expect(runPart).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
  });

  it("answers a refusal that reached Mongo by its code alone, and audits it", async () => {
    runPart.mockRejectedValue(refuseQuery("TOO_MANY_TO_COUNT"));

    expect((await failure(ask())).output.payload).toEqual({
      statusCode: 400,
      reason: "EXPLORE_QUERY_REFUSED",
      refusal: "TOO_MANY_TO_COUNT",
    });
    expect(audits()[0]).toMatchObject({
      status: "failure",
      details: { outcome: "TOO_MANY_TO_COUNT" },
    });
  });

  it("reads for the time GAS has left", async () => {
    runPart.mockResolvedValue(PART);

    const started = Date.now();

    await ask(query(), 2000);

    const [[, , meter]] = runPart.mock.calls;

    expect(meter.deadline - started).toBeGreaterThanOrEqual(2000);
    expect(meter.deadline - started).toBeLessThan(2100);
  });

  it("stops at its next check when GAS gives up", async () => {
    const stopped = new AbortController();

    runPart.mockImplementation(async (_, __, meter) => {
      stopped.abort();

      return meter.deadline === 0
        ? Promise.reject(refuseQuery("TOO_SLOW"))
        : PART;
    });

    const error = await failure(
      exploreQueryUseCase({
        query: query(),
        operator: OPERATOR,
        caller: "fg-gas-backend",
        timeLeftMs: 5000,
        signal: stopped.signal,
      }),
    );

    expect(error.output.payload).toMatchObject({ refusal: "TOO_SLOW" });
  });

  it("says why a read couldn't be exact", async () => {
    runPart.mockRejectedValue(
      refuseQuery("GROUP_NEEDS_EXACT", {
        why: "NOT_INDEXED",
        path: BUSINESS,
      }),
    );

    expect((await failure(ask())).output.payload).toEqual({
      statusCode: 400,
      reason: "EXPLORE_QUERY_REFUSED",
      refusal: "GROUP_NEEDS_EXACT",
      detail: { why: "NOT_INDEXED", path: BUSINESS },
    });
  });

  it("refuses a second query of the same operator while the first runs", async () => {
    let finish;

    runPart.mockReturnValue(new Promise((resolve) => (finish = resolve)));

    const first = ask();

    expect((await failure(ask())).output.payload).toEqual({
      statusCode: 429,
      reason: "EXPLORE_QUERY_BUSY",
      refusal: "BUSY",
    });

    finish(PART);
    await first;
  });

  it("refuses a query past the instance's limit, whoever asks", async () => {
    const finishes = [];

    runPart.mockImplementation(
      () => new Promise((resolve) => finishes.push(resolve)),
    );

    const held = ["a", "b"].map((n) =>
      exploreQueryUseCase({
        query: query(),
        operator: { ...OPERATOR, id: `${n}${OPERATOR_ID.slice(1)}` },
        caller: "fg-gas-backend",
        timeLeftMs: 5000,
      }),
    );

    expect((await failure(ask())).output.payload).toEqual({
      statusCode: 429,
      reason: "EXPLORE_QUERY_BUSY",
      refusal: "FULL",
    });

    await vi.waitFor(() => expect(finishes).toHaveLength(2));
    finishes.forEach((finish) => finish(PART));
    await Promise.all(held);
  });

  it("refuses with 503 before any read, writing no audit, without its audit key", async () => {
    config.get.mockReturnValue(null);
    runPart.mockResolvedValue(PART);

    const error = await failure(ask());

    expect(error.output.statusCode).toBe(503);
    expect(error.output.payload).toEqual({
      statusCode: 503,
      reason: "EXPLORE_QUERY_UNAUDITABLE",
    });
    expect(findNewestWorkflows).not.toHaveBeenCalled();
    expect(runPart).not.toHaveBeenCalled();
    expect(writeAuditEvent).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Explore can't audit queries: SEARCH_AUDIT_KEY isn't set",
    );
  });

  it("logs its entry and its finish as one action, naming the source", async () => {
    runPart.mockResolvedValue(PART);

    await ask();

    expect(logger.info.mock.calls.map(([line]) => line)).toEqual([
      "Explore query on cases",
      "Finished: Explore query on cases",
    ]);
  });

  it("passes on any other failure", async () => {
    runPart.mockRejectedValue(new Error("Explore read failed"));

    expect((await failure(ask())).message).toBe("Explore read failed");
  });
});

const ALLOWED = "payload.answers.woodlandName";
const FORGED = "payload.answers.anyOtherAnswer.secretish";

const PATH_AT = {
  filter: (path) =>
    query({
      columns: [{ path: "caseRef" }],
      where: { path, op: "eq", values: [SENTINEL] },
    }),
  projection: (path) =>
    query({ columns: [{ path: "caseRef" }, { path }], where: null }),
  aggregate: (path) =>
    query({ columns: [{ fn: "max", path, as: "most" }], where: null }),
  group: (path) =>
    query({
      mode: "groups",
      columns: [{ path }, { fn: "count", path: "*" }],
      where: null,
      groupBy: { path },
    }),
  sort: (path) =>
    query({
      columns: [{ path: "caseRef" }],
      where: null,
      orderBy: { path, fn: null, desc: true },
    }),
  unwind: (path) =>
    query({
      columns: [{ path: "caseRef" }],
      where: null,
      unwind: [{ path, preserve: true }],
    }),
  distinct: (path) =>
    query({
      mode: "distinct",
      columns: [{ path }],
      where: null,
      groupBy: { path },
    }),
  countDocuments: (path) =>
    query({
      mode: "count",
      columns: [{ fn: "count", path: "*" }],
      where: { path, op: "filled", values: [] },
    }),
  $or: (path) =>
    query({
      columns: [{ path: "caseRef" }],
      where: {
        any: [
          { path: "caseRef", op: "eq", values: ["c"] },
          { not: { path, op: "eq", values: [SENTINEL] } },
        ],
      },
    }),
};

const refusedFor = async (asked) => {
  const error = await failure(ask(asked));

  expect(error.output.payload).toEqual({
    statusCode: 400,
    reason: "EXPLORE_QUERY_REFUSED",
    refusal: "PATH_NOT_ALLOWED",
  });
  expect(runPart).not.toHaveBeenCalled();
  expect(writeAuditEvent).not.toHaveBeenCalled();
  expect(logger.warn).not.toHaveBeenCalled();

  const logged = JSON.stringify(Object.values(logger).map((f) => f.mock));

  expect(logged).not.toContain("secretish");
  expect(logged).not.toContain("entinel");

  return logged;
};

describe("exploreQueryUseCase's paths", () => {
  it.each(Object.keys(PATH_AT))(
    "reads an answer on its list, named in the %s",
    async (place) => {
      runPart.mockResolvedValue(PART);

      expect(await ask(PATH_AT[place](ALLOWED))).toEqual(PART);
    },
  );

  it.each(Object.keys(PATH_AT))(
    "refuses an answer off its list, named in the %s, reading, auditing and logging nothing of it",
    async (place) => {
      await refusedFor(PATH_AT[place](FORGED));
    },
  );

  it.each([
    ["a root it doesn't read", "comments.secretish"],
    ["the timeline", "timeline.secretish"],
    ["a denied name", "payload.bank.secretish"],
    ["an internal name", "payload._secretish"],
    ["a list's parent", "payload.answers.applicant.business"],
    ["the answers themselves", "payload.answers"],
  ])("refuses %s on cases", async (_, path) => {
    await refusedFor(PATH_AT.projection(path));
  });

  it.each([
    ["a root it doesn't read", "comments"],
    ["a denied name", "payload.bank"],
  ])("refuses to unwind %s on cases", async (_, path) => {
    await refusedFor(PATH_AT.unwind(path));
  });

  it("passes the answer list it checked to the read", async () => {
    runPart.mockResolvedValue(PART);

    await ask(PATH_AT.unwind(ALLOWED));

    expect(runPart).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ at: "payload.answers" }),
    );
  });

  it.each([
    [
      "workflows",
      "definition.endpoints.secretish",
      { columns: [{ path: "grantCode" }] },
    ],
    [
      "workflows",
      "definition.externalActions.secretish",
      { columns: [{ path: "grantCode" }] },
    ],
    [
      "events",
      "event.audit.details.secretish",
      { columns: [{ path: "eventType" }] },
    ],
    ["events", "event.ip", { columns: [{ path: "eventType" }] }],
    ["events", "claimedBy", { columns: [{ path: "eventType" }] }],
    [
      "events",
      "event.data.payload.answers.anyOtherAnswer.secretish",
      { columns: [{ path: "eventType" }] },
    ],
  ])("refuses %s %s", async (source, path, rest) => {
    await refusedFor(
      query({
        source,
        ...rest,
        where: { path, op: "filled", values: [] },
      }),
    );
  });

  it("refuses every path off its lists alike, naming none", async () => {
    await refusedFor(
      query({
        columns: [{ path: "comments.secretish" }, { path: FORGED }],
        where: null,
      }),
    );
  });

  it.each([
    ["events", { path: "event.data.payload.answers.woodlandName" }],
    ["events", { path: "service" }],
    ["events", { path: "event.data.caseRef" }],
    ["workflows", { path: "definition.phases.stages.code" }],
    ["cases", { path: "payload.answers.landParcels.0.areaHa" }],
    ["cases", { path: "phases.stages.taskGroups.tasks.code" }],
  ])("reads %s %o", async (source, column) => {
    runPart.mockResolvedValue(PART);

    await ask(query({ source, columns: [column], where: null }));

    expect(runPart).toHaveBeenCalled();
  });

  it("shows in its audit only the words its paths and answers are made of", async () => {
    runPart.mockResolvedValue(PART);

    await ask(
      query({
        columns: [
          { path: "payload.answers.woodlandName" },
          { path: "phases.stages.Jane-Smith" },
        ],
        where: {
          path: "supplementaryData.JaneSmith",
          op: "filled",
          values: [],
        },
      }),
    );

    expect(audits()[0].details.shape).toBe(
      "db.cases.find({ 'supplementaryData.?': { $exists: true } }, { 'payload.answers.woodlandName': 1, 'phases.stages.?': 1 }).limit(?)",
    );
    expect(audits()[0].details.conditions).toEqual([
      { path: "supplementaryData.?", op: "filled" },
    ]);
  });

  it("digests each value with its type", async () => {
    runPart.mockResolvedValue(PART);

    await ask(
      query({
        columns: [{ path: "caseRef" }],
        where: {
          path: "closed",
          op: "in",
          values: [true, "true", 1, null, { date: "2026-11-01" }],
        },
      }),
    );

    expect(audits()[0].details.conditions[0].digests).toEqual(
      [
        "closed:true",
        'closed:"true"',
        "closed:1",
        "closed:null",
        "closed:ISODate(2026-11-01T00:00:00.000Z)",
      ].map((text) => valueDigest(KEY, text)),
    );
  });

  it("counts GAS's time from arrival, loading its answer list included", async () => {
    findNewestWorkflows.mockImplementation(async () => {
      await setTimeout(200);

      return [WORKFLOW];
    });
    runPart.mockResolvedValue(PART);

    const started = Date.now();

    await ask(PATH_AT.projection(ALLOWED), 2000);

    const [[, , meter]] = runPart.mock.calls;

    expect(meter.deadline - started).toBeLessThan(2100);
  });

  it("stops at its first check when GAS gave up while it loaded its answer list", async () => {
    const stopped = new AbortController();

    findNewestWorkflows.mockImplementation(async () => {
      stopped.abort();

      return [WORKFLOW];
    });
    runPart.mockImplementation(async (_, __, meter) =>
      meter.deadline === 0 ? Promise.reject(refuseQuery("TOO_SLOW")) : PART,
    );

    const error = await failure(
      exploreQueryUseCase({
        query: PATH_AT.projection(ALLOWED),
        operator: OPERATOR,
        caller: "fg-gas-backend",
        timeLeftMs: 5000,
        signal: stopped.signal,
      }),
    );

    expect(error.output.payload).toMatchObject({ refusal: "TOO_SLOW" });
  });

  it("never reads its workflows for a query without answers", async () => {
    runPart.mockResolvedValue(PART);

    await ask(query({ columns: [{ path: "caseRef" }], where: null }));

    expect(findNewestWorkflows).not.toHaveBeenCalled();
  });

  it("fails, never refusing nor reading, when its workflows can't be read", async () => {
    findNewestWorkflows.mockRejectedValueOnce(new Error("Mongo down"));

    const error = await failure(ask(PATH_AT.projection(ALLOWED)));

    expect(error.message).toBe("Mongo down");
    expect(runPart).not.toHaveBeenCalled();
  });
});
