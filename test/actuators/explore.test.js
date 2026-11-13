import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listExploreSources,
  queryExplore,
  seedCaseReaderToken,
} from "../helpers/actuators.js";
import { SERVICE_TOKEN } from "../helpers/service-token.js";

let client;
let db;

const SENTINEL = "Sentinel Farm 4417";
const NOW = Date.UTC(2026, 9, 9, 12);
const minutesAgo = (minutes) => new Date(NOW - minutes * 60_000);

const aCase = (n, overrides = {}) => ({
  _id: new ObjectId(),
  caseRef: `case-${n}`,
  workflowCode: "example-workflow",
  currentConfigVersion: "1.0.0",
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW",
  currentStatus: n % 2 ? "IN_REVIEW" : "APPLICATION_RECEIVED",
  closed: false,
  createdAt: minutesAgo(n),
  payload: {
    identifiers: { sbi: `90000000${n}` },
    answers: {
      applicant: { business: { name: n === 3 ? SENTINEL : `Business ${n}` } },
      application: { parcel: [{ parcelId: "1234", sheetId: "SX1234" }] },
    },
  },
  refs: [`ref:case-${n}`, `sbi:90000000${n}`],
  ...overrides,
});

const anEvent = (n, publicationDate, overrides = {}) => ({
  _id: new ObjectId(),
  status: n % 2 ? "DEAD_LETTER" : "COMPLETED",
  eventType: "CaseStatusUpdated",
  publicationDate,
  claimedBy: "test-holder",
  claimExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
  segregationRef: `seg-${n}`,
  event: { id: `event-${n}`, data: { caseRef: `case-${n}` } },
  refs: [`ref:case-${n}`, `id:event-${n}`],
  ...overrides,
});

const BUSINESS = "payload.answers.applicant.business.name";
const PARCEL = "payload.answers.application.parcel.parcelId";

const query = (overrides = {}) => ({
  v: 2,
  source: "cases",
  mode: "rows",
  columns: [{ path: "caseRef" }, { path: BUSINESS }],
  where: { path: "workflowCode", op: "eq", values: ["example-workflow"] },
  unwind: [],
  groupBy: null,
  orderBy: null,
  limit: 50,
  positions: null,
  ...overrides,
});

const bodyOf = (error) => {
  const payload = error.data?.payload;

  return Buffer.isBuffer(payload) ? JSON.parse(payload.toString()) : payload;
};

const refusalOf = async (request) => {
  const error = await request.catch((e) => e);

  return { status: error.output?.statusCode, body: bodyOf(error) };
};

const audits = () =>
  db.collection("outbox").find({ segregationRef: "admin-explore" }).toArray();

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  await seedCaseReaderToken(db);
});

afterAll(async () => {
  await client?.close(true);
});

describe("GET /actuators/explore/sources", () => {
  it("lists the Query versions it reads, and what each source may read", async () => {
    const { payload } = await listExploreSources();

    expect(payload.versions).toEqual([2]);
    expect(payload.sources.map(({ name }) => name)).toEqual([
      "cases",
      "workflows",
      "events",
    ]);

    const [cases, workflows, events] = payload.sources;

    expect(cases).toMatchObject({
      label: "Cases, in Caseworking",
      service: "CW",
      size: "big",
      noun: { one: "case", many: "cases" },
      time: "createdAt",
      star: ["caseRef", "workflowCode", "currentStatus", "createdAt"],
      answersAt: "payload.answers",
      listedAt: "payload.answers",
    });
    expect(cases.roots).not.toContain("comments");
    expect(cases.paths).toContainEqual(
      expect.objectContaining({ path: "caseRef", index: "ref" }),
    );
    expect(cases.paths).toContainEqual(
      expect.objectContaining({
        path: "createdAt",
        index: "time",
        stored: "date",
      }),
    );
    expect(
      cases.paths.find(({ path }) => path === "currentConfigVersion"),
    ).toEqual({
      path: "currentConfigVersion",
      type: "text",
      index: "fact",
      closed: false,
      within: "workflowCode",
    });
    expect(workflows.roots).not.toContain("definition.endpoints");
    expect(events.roots).toEqual(expect.arrayContaining(["service", "box"]));
    expect(events.roots).not.toContain("event");
    expect(JSON.stringify(payload)).not.toContain('"fields"');
  });

  it("names the answer paths a Query may read where it checks them", async () => {
    const { payload } = await listExploreSources();
    const [cases, workflows, events] = payload.sources;

    expect(cases.answerPaths).toEqual(
      expect.arrayContaining([
        "applicant.business.name",
        "application.parcel.parcelId",
      ]),
    );
    expect(workflows.answerPaths).toBeUndefined();
    expect(events.listedAt).toBe("event.data.payload.answers");
    expect(events.answerPaths).toEqual(cases.answerPaths);
  });

  it("gives closed paths their known values, stored ones read from the index", async () => {
    await db.collection("cases").insertMany([1, 2].map((n) => aCase(n)));

    const { payload } = await listExploreSources();
    const [cases, , events] = payload.sources;
    const valuesOf = (source, path) =>
      source.paths.find((entry) => entry.path === path).values;

    expect(valuesOf(cases, "workflowCode")).toEqual([
      { value: "example-workflow", label: "example-workflow" },
    ]);
    expect(valuesOf(events, "status").length).toBeGreaterThan(0);
    expect(valuesOf(events, "eventType").length).toBeGreaterThan(0);
    expect(valuesOf(events, "service")).toEqual([
      { value: "GAS", label: "Grant Application Service" },
      { value: "CW", label: "Caseworking" },
    ]);
    expect(valuesOf(events, "box")).toEqual([
      { value: "outbox", label: "outbox" },
      { value: "inbox", label: "inbox" },
    ]);
    expect(valuesOf(cases, "caseRef")).toBeUndefined();
  });

  it("answers 403 to a client other than fg-gas-backend", async () => {
    await expect(
      listExploreSources({ authorization: `Bearer ${SERVICE_TOKEN}` }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });
});

describe("POST /actuators/explore/query", () => {
  it("reads cases exactly, answers too, rows per box, and audits the shape", async () => {
    await db.collection("cases").insertMany([1, 2, 3].map((n) => aCase(n)));

    const { payload } = await queryExplore(query());

    expect(payload).toEqual({
      read: "exact",
      groups: null,
      boxes: [
        {
          id: "cw.cases",
          to: null,
          end: true,
          count: { n: 3, capped: false },
          rows: [1, 2, 3].map((n) => ({
            key: { t: minutesAgo(n).toISOString(), i: expect.any(String) },
            open: { kind: "case", code: "example-workflow", ref: `case-${n}` },
            cells: {
              c0: `case-${n}`,
              c1: n === 3 ? SENTINEL : `Business ${n}`,
            },
            order: null,
          })),
        },
      ],
    });

    const [audit] = await audits();

    expect(audit.event.audit).toMatchObject({
      status: "success",
      entities: [
        {
          entity: "EXPLORE_SOURCE",
          action: "EXPLORE_QUERY",
          entityid: "cases",
        },
      ],
      details: {
        source: "cases",
        read: "exact",
        shape: `db.cases.find({ workflowCode: ? }, { caseRef: 1, '${BUSINESS}': 1 }).limit(?)`,
        conditions: [{ path: "workflowCode", op: "eq" }],
        window: "first",
        resultCount: 3,
        outcome: "ANSWERED",
      },
    });
  });

  it("reads a case by its reference exactly, as stored, through the refs index", async () => {
    await db.collection("cases").insertMany([1, 2, 3].map((n) => aCase(n)));

    const found = await queryExplore(
      query({ where: { path: "caseRef", op: "eq", values: ["case-2"] } }),
    );
    const otherCase = await queryExplore(
      query({ where: { path: "caseRef", op: "eq", values: ["CASE-2"] } }),
    );
    const byRefs = await queryExplore(
      query({ where: { path: "refs", op: "eq", values: ["sbi:900000003"] } }),
    );

    expect(found.payload.read).toBe("exact");
    expect(found.payload.boxes[0].count).toEqual({ n: 1, capped: false });
    expect(otherCase.payload.boxes[0].count).toEqual({ n: 0, capped: false });
    expect(byRefs.payload.boxes[0].rows.map(({ cells }) => cells.c0)).toEqual([
      "case-3",
    ]);
  });

  it("tests what a case's reference and code leave over, found by its reference", async () => {
    await db.collection("cases").insertMany([1, 2, 3].map((n) => aCase(n)));

    const asked = (status) =>
      queryExplore(
        query({
          where: {
            all: [
              { path: "caseRef", op: "eq", values: ["case-1"] },
              { path: "workflowCode", op: "eq", values: ["example-workflow"] },
              { path: "currentStatus", op: "eq", values: [status] },
            ],
          },
        }),
      );

    const closed = await asked("CLOSED");
    const inReview = await asked("IN_REVIEW");

    expect(closed.payload.boxes[0].rows).toEqual([]);
    expect(inReview.payload.boxes[0].rows.map(({ cells }) => cells.c0)).toEqual(
      ["case-1"],
    );
  });

  it("reads a residual a window at a time, and keeps no value in its audit", async () => {
    await db.collection("cases").insertMany([1, 2, 3, 4].map((n) => aCase(n)));

    const { payload } = await queryExplore(
      query({
        columns: [{ path: "caseRef" }, { fn: "count", path: PARCEL }],
        where: {
          path: BUSINESS,
          op: "regex",
          values: [{ pattern: "sentinel farm", flags: "i" }],
        },
      }),
    );

    expect(payload.read).toBe("windowed");
    expect(payload.boxes[0]).toMatchObject({
      end: true,
      to: null,
      count: null,
      rows: [{ cells: { c0: "case-3", c1: 1 } }],
    });
    expect(JSON.stringify(await audits())).not.toContain("entinel");
  });

  it("matches text exactly, as mongosh does", async () => {
    await db.collection("cases").insertMany([1, 2, 3].map((n) => aCase(n)));

    const asked = (value) =>
      queryExplore(
        query({ where: { path: BUSINESS, op: "eq", values: [value] } }),
      );

    expect((await asked(SENTINEL)).payload.boxes[0].rows).toHaveLength(1);
    expect((await asked(SENTINEL.toLowerCase())).payload.boxes[0].rows).toEqual(
      [],
    );
  });

  it("groups an exact read by each value and its type", async () => {
    await db.collection("cases").insertMany([1, 2, 3].map((n) => aCase(n)));

    const { payload } = await queryExplore(
      query({
        mode: "groups",
        columns: [{ path: "currentStatus" }, { fn: "count", path: "*" }],
        groupBy: { path: "currentStatus" },
      }),
    );

    expect(payload.groups).toEqual([
      {
        key: "string:IN_REVIEW",
        value: "IN_REVIEW",
        n: 2,
        aggs: { "count(*)": 2 },
      },
      {
        key: "string:APPLICATION_RECEIVED",
        value: "APPLICATION_RECEIVED",
        n: 1,
        aggs: { "count(*)": 1 },
      },
    ]);
  });

  it("sends each row's sort value with its type, for GAS to sort by", async () => {
    await db
      .collection("cases")
      .insertMany([1, 2].map((n) => aCase(n, { closed: n === 2 })));

    const { payload } = await queryExplore(
      query({
        columns: [{ path: "caseRef" }, { path: "closed" }],
        orderBy: { path: "closed", fn: null, desc: true },
      }),
    );

    expect(payload.boxes[0].rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cells: { c0: "case-1", c1: "false" },
          order: { b: false },
        }),
        expect.objectContaining({
          cells: { c0: "case-2", c1: "true" },
          order: { b: true },
        }),
      ]),
    );
  });

  it("sends each group's sum as its sum, addend and plain sum, and its times typed", async () => {
    await db
      .collection("outbox")
      .insertMany(
        [1, 3, 5].map((n) =>
          anEvent(n, minutesAgo(n), { completionAttempts: n / 10 }),
        ),
      );

    const { payload } = await queryExplore(
      query({
        source: "events",
        mode: "groups",
        columns: [
          { path: "eventType" },
          { fn: "sum", path: "completionAttempts" },
          { fn: "min", path: "publicationDate" },
          { fn: "max", path: "publicationDate" },
        ],
        where: { path: "status", op: "eq", values: ["DEAD_LETTER"] },
        groupBy: { path: "eventType" },
      }),
    );

    expect(payload.groups).toEqual([
      {
        key: "string:CaseStatusUpdated",
        value: "CaseStatusUpdated",
        n: 3,
        aggs: {
          "sum(completionAttempts)": [0.9, -2.7755575615628914e-17, 0.9],
          "min(publicationDate)": { d: minutesAgo(5).toISOString() },
          "max(publicationDate)": { d: minutesAgo(1).toISOString() },
        },
      },
    ]);
  });

  it("counts an exact read, and lists the distinct values at a path", async () => {
    await db.collection("cases").insertMany([1, 2, 3].map((n) => aCase(n)));

    const counted = await queryExplore(
      query({ mode: "count", columns: [{ fn: "count", path: "*" }] }),
    );
    const distinct = await queryExplore(
      query({
        mode: "distinct",
        columns: [{ path: "currentStatus" }],
        groupBy: { path: "currentStatus" },
      }),
    );

    expect(counted.payload.boxes[0].count).toEqual({ n: 3, capped: false });
    expect(distinct.payload.groups.map(({ value }) => value).sort()).toEqual([
      "APPLICATION_RECEIVED",
      "IN_REVIEW",
    ]);
  });

  it("reads its outbox's Dates and its inbox's ISO text alike, by one date bound", async () => {
    await db
      .collection("outbox")
      .insertMany([1, 2, 3].map((n) => anEvent(n, minutesAgo(n))));
    await db.collection("inbox").insertMany(
      [4, 5].map((n) =>
        anEvent(n, minutesAgo(n).toISOString(), {
          eventType: "UpdateCaseStatus",
        }),
      ),
    );

    const { payload } = await queryExplore(
      query({
        source: "events",
        columns: [
          { path: "publicationDate" },
          { path: "box" },
          { path: "status" },
        ],
        where: {
          all: [
            { path: "status", op: "eq", values: ["DEAD_LETTER"] },
            {
              path: "publicationDate",
              op: "gte",
              values: [{ date: minutesAgo(5).toISOString() }],
            },
          ],
        },
      }),
    );

    expect(payload.read).toBe("exact");
    expect(
      payload.boxes.map(({ id, rows, count }) => [
        id,
        rows.map(({ cells }) => cells),
        count.n,
      ]),
    ).toEqual([
      [
        "cw.outbox",
        [1, 3].map((n) => ({
          c0: minutesAgo(n).toISOString(),
          c1: "outbox",
          c2: "DEAD_LETTER",
        })),
        2,
      ],
      [
        "cw.inbox",
        [
          {
            c0: minutesAgo(5).toISOString(),
            c1: "inbox",
            c2: "DEAD_LETTER",
          },
        ],
        1,
      ],
    ]);
    expect(payload.boxes[0].rows[0].open).toEqual({
      kind: "event",
      service: "CW",
      box: "outbox",
      id: expect.any(String),
    });
  });

  it("reads workflow versions in full, with their stored definitions", async () => {
    await db.collection("config_versions").insertOne({
      _id: new ObjectId(),
      grantCode: "explore-workflow",
      version: "1.0.0",
      major: 1,
      minor: 0,
      patch: 0,
      status: "active",
      fetchStatus: "fetched",
      receivedAt: minutesAgo(1).toISOString(),
    });
    await db.collection("workflows").insertOne({
      code: "explore-workflow",
      version: "1.0.0",
      endpoints: [{ code: "X", url: "https://internal.example" }],
      phases: [
        {
          code: "P",
          stages: [
            {
              code: "S",
              taskGroups: [{ code: "G", tasks: [{ code: "CHECK_PLAN" }] }],
            },
          ],
        },
      ],
    });

    const TASKS = "definition.phases.stages.taskGroups.tasks.code";
    const { payload } = await queryExplore(
      query({
        source: "workflows",
        columns: [
          { path: "grantCode" },
          { path: "status" },
          { fn: "count", path: TASKS },
          { path: "definition.phases" },
        ],
        where: { path: TASKS, op: "eq", values: ["CHECK_PLAN"] },
      }),
    );

    expect(payload).toMatchObject({
      read: "full",
      boxes: [
        {
          id: "cw.workflows",
          rows: [
            {
              open: {
                kind: "workflow",
                code: "explore-workflow",
                version: "1.0.0",
              },
              cells: {
                c0: "explore-workflow",
                c1: "active",
                c2: 1,
                c3: {
                  text: "{ code: 'P', stages: [ { code: 'S', taskGroups: [ { code: 'G', tasks: [ { code: 'CHECK_PLAN' } ] } ] } ] }",
                },
              },
            },
          ],
          count: { n: 1, capped: false },
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("internal.example");

    await db
      .collection("config_versions")
      .deleteMany({ grantCode: "explore-workflow" });
  });

  it.each([
    ["v1's field names", query({ columns: [{ field: "caseRef" }] })],
    ["v1's answers", query({ answers: {} })],
    ["an unknown version", query({ v: 1 })],
    ["an operator as a path", query({ columns: [{ path: "$where" }] })],
    ["a positional path", query({ columns: [{ path: "phases.$.code" }] })],
    [
      "__proto__ in a path",
      query({ where: { path: "payload.__proto__", op: "filled", values: [] } }),
    ],
    ["a denied path", query({ columns: [{ path: "payload.answers.bank" }] })],
    ["_id", query({ columns: [{ path: "_id" }] })],
    [
      "a pattern the matcher won't take",
      query({
        where: {
          path: BUSINESS,
          op: "regex",
          values: [{ pattern: "(a)\\1", flags: "" }],
        },
      }),
    ],
    ["no mode", query({ mode: undefined })],
    [
      "distinct values with no path to group by",
      query({
        mode: "distinct",
        columns: [{ path: "currentStatus" }],
        groupBy: null,
      }),
    ],
    [
      "a count with a column other than the count",
      query({ mode: "count", columns: [{ path: "caseRef" }] }),
    ],
    [
      "more cells than an answer holds",
      query({
        columns: Array.from({ length: 20 }, () => ({ path: "caseRef" })),
        limit: 5000,
      }),
    ],
    ["another service's box", query({ positions: { "gas.outbox": null } })],
    ["a * column that isn't a count", query({ columns: [{ path: "*" }] })],
    [
      "an operator as a value",
      query({ where: { path: "caseRef", op: "eq", values: [{ $gt: "" }] } }),
    ],
  ])("refuses %s, reading and auditing nothing", async (_, payload) => {
    expect(await refusalOf(queryExplore(payload))).toEqual({
      status: 400,
      body: { statusCode: 400, reason: "EXPLORE_QUERY_INVALID" },
    });
    expect(await audits()).toEqual([]);
  });

  it.each([
    [
      "an answer off its own list",
      query({
        columns: [{ path: "payload.answers.anyOtherAnswer.secretish" }],
      }),
    ],
    ["a case's comments", query({ columns: [{ path: "comments.text" }] })],
    ["a case's timeline", query({ columns: [{ path: "timeline" }] })],
    [
      "a workflow's endpoints",
      query({
        source: "workflows",
        columns: [{ path: "definition.endpoints.code" }],
        where: null,
      }),
    ],
    [
      "an audit event's actor",
      query({
        source: "events",
        columns: [{ path: "event.audit.details.security.actor.email" }],
        where: null,
      }),
    ],
    [
      "an inbox's answer off the list",
      query({
        source: "events",
        columns: [{ path: "eventType" }],
        where: {
          path: "event.data.payload.answers.anyOtherAnswer.secretish",
          op: "filled",
          values: [],
        },
      }),
    ],
  ])("refuses %s, reading and auditing nothing", async (_, payload) => {
    await db.collection("cases").insertMany([1, 2].map((n) => aCase(n)));

    expect(await refusalOf(queryExplore(payload))).toEqual({
      status: 400,
      body: {
        statusCode: 400,
        reason: "EXPLORE_QUERY_REFUSED",
        refusal: "PATH_NOT_ALLOWED",
      },
    });
    expect(await audits()).toEqual([]);
  });

  it("refuses $group on a windowed read by its code, for GAS to word", async () => {
    expect(
      await refusalOf(
        queryExplore(
          query({
            mode: "groups",
            columns: [{ path: "currentStatus" }],
            where: {
              path: BUSINESS,
              op: "regex",
              values: [{ pattern: "x", flags: "" }],
            },
            groupBy: { path: "currentStatus" },
          }),
        ),
      ),
    ).toEqual({
      status: 400,
      body: {
        statusCode: 400,
        reason: "EXPLORE_QUERY_REFUSED",
        refusal: "GROUP_NEEDS_EXACT",
        detail: { why: "NOT_INDEXED", path: BUSINESS },
      },
    });
  });

  it("reads for the time GAS has left", async () => {
    await db.collection("cases").insertMany([1, 2].map((n) => aCase(n)));

    const { payload } = await queryExplore(query(), {
      "x-explore-time-left-ms": "4000",
    });

    expect(payload.boxes[0].count.n).toBe(2);
    expect(
      await refusalOf(queryExplore(query(), { "x-explore-time-left-ms": "0" })),
    ).toMatchObject({ status: 400, body: { reason: "EXPLORE_QUERY_INVALID" } });
  });

  it("answers 403 to a client other than fg-gas-backend", async () => {
    await expect(
      queryExplore(query(), { authorization: `Bearer ${SERVICE_TOKEN}` }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });
});
