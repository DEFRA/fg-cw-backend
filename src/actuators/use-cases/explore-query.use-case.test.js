import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATOR_ID, OPERATOR_NAME } from "../../../test/helpers/operator.js";
import { casesSource } from "../../cases/explore/cases.source.js";
import { workflowsSource } from "../../cases/explore/workflows.source.js";
import {
  clearExploreSources,
  registerExploreSource,
} from "../../common/explore-sources/registry.js";
import { refuseQuery } from "../../common/explore/refusal.js";
import { runPart } from "../../common/explore/run.js";
import { logger } from "../../common/logger.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { eventsSource } from "../../events/explore/events.source.js";
import { exploreQueryUseCase } from "./explore-query.use-case.js";

vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../common/explore/run.js");
vi.mock("../../common/write-audit-event.js");
vi.mock("../../common/with-transaction.js", () => ({
  withTransaction: (work) => work({ session: true }),
}));

const SENTINEL = "Sentinel Farm 4417";
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
    timeLeftMs,
  });

const failure = (promise) => promise.catch((error) => error);

const audits = () => writeAuditEvent.mock.calls.map(([event]) => event);

beforeEach(() => {
  clearExploreSources();
  [casesSource, workflowsSource, eventsSource].forEach(registerExploreSource);
  writeAuditEvent.mockResolvedValue();
});

describe("exploreQueryUseCase", () => {
  it("audits a part that skipped a record too large to search as partial", async () => {
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
      resultCount: 0,
    });
  });

  it("reads its source and audits only that it was queried", async () => {
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
      security: { pmccode: "0706" },
    });
    expect(event.details).toEqual({
      security: expect.any(Object),
      source: "cases",
      resultCount: 2,
      outcome: "ANSWERED",
    });
    expect(JSON.stringify(event)).not.toContain("payload");
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

const ANSWER = "payload.answers.anyOtherAnswer";

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
    "reads any answer below its roots, named in the %s",
    async (place) => {
      runPart.mockResolvedValue(PART);

      expect(await ask(PATH_AT[place](ANSWER))).toEqual(PART);
    },
  );

  it.each(Object.keys(PATH_AT))(
    "refuses a denied answer, named in the %s, reading, auditing and logging nothing of it",
    async (place) => {
      await refusedFor(PATH_AT[place]("payload.answers.bank.secretish"));
    },
  );

  it.each([
    ["a root it doesn't read", "comments.secretish"],
    ["the timeline", "timeline.secretish"],
    ["a denied name", "payload.bank.secretish"],
    ["an internal name", "payload._secretish"],
  ])("refuses %s on cases", async (_, path) => {
    await refusedFor(PATH_AT.projection(path));
  });

  it.each([
    ["a root it doesn't read", "comments"],
    ["a denied name", "payload.bank"],
  ])("refuses to unwind %s on cases", async (_, path) => {
    await refusedFor(PATH_AT.unwind(path));
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
  ])("refuses %s %s", async (source, path, rest) => {
    await refusedFor(
      query({
        source,
        ...rest,
        where: { path, op: "filled", values: [] },
      }),
    );
  });

  it("refuses every path off its roots or denied alike, naming none", async () => {
    await refusedFor(
      query({
        columns: [
          { path: "comments.secretish" },
          { path: "payload.bank.secretish" },
        ],
        where: null,
      }),
    );
  });

  it.each([
    ["events", { path: "event.data.payload.answers.woodlandName" }],
    ["events", { path: "event.data.payload.answers.anyOtherAnswer" }],
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
});
