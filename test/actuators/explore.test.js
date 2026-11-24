import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mergeExact } from "../../src/common/explore/merge.js";
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
  v: 3,
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

const idsOf = (filter) =>
  [filter, ...(filter.$and ?? [])]
    .flatMap((part) => part._id?.$in ?? [])
    .map(String)
    .toSorted();

// The finds Mongo ran on the collections while `work` ran: each one's hint and
// the ids it asked for.
const profiled = async (collections, work) => {
  await db.command({ profile: 2 });

  try {
    const result = await work();
    const finds = await db
      .collection("system.profile")
      .find({
        ns: {
          $in: [collections].flat().map((name) => `${db.databaseName}.${name}`),
        },
        op: "query",
      })
      .toArray();

    return {
      ...result,
      finds: finds.map(({ command }) => ({
        hint: command.hint,
        ids: idsOf(command.filter),
      })),
    };
  } finally {
    await db.command({ profile: 0 });
    await db.collection("system.profile").drop();
  }
};

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
  it("lists the paths each source suggests", async () => {
    const { payload } = await listExploreSources();

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
    });
    expect(cases).not.toHaveProperty("answerPaths");
    expect(cases).not.toHaveProperty("listedAt");
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
    expect(cases.paths[0]).toEqual({
      path: "_id",
      type: "objectId",
      index: "id",
      closed: false,
      within: null,
    });
    expect(events.paths[0]).toEqual(cases.paths[0]);
    expect(workflows.paths[0]).toEqual({
      path: "_id",
      type: "objectId",
      index: null,
      closed: false,
      within: null,
    });
    expect(payload.sources.filter((source) => "roots" in source)).toEqual([]);
    expect(JSON.stringify(payload)).not.toContain('"fields"');
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
  it("reads cases exactly, answers too, rows per box, and audits only that it was queried", async () => {
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
        resultCount: 3,
        outcome: "ANSWERED",
      },
    });
    expect(audit.event.audit.details).not.toHaveProperty("shape");
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
      "a column on a $ key",
      query({ columns: [{ path: "payload.answers.$schema" }] }),
    ],
    [
      "an unwind of a $ key",
      query({ unwind: [{ path: "payload.answers.$defs", preserve: true }] }),
    ],
    [
      "__proto__ in a path",
      query({ where: { path: "payload.__proto__", op: "filled", values: [] } }),
    ],
    [
      "an ObjectId in upper case",
      query({
        where: {
          path: "_id",
          op: "eq",
          values: [{ oid: "6741A0C2E4B0F1A2B3C4D5E6" }],
        },
      }),
    ],
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
  ])("refuses %s, auditing nothing", async (_, payload) => {
    expect(await refusalOf(queryExplore(payload))).toEqual({
      status: 400,
      body: { statusCode: 400, reason: "EXPLORE_QUERY_INVALID" },
    });
    expect(await audits()).toEqual([]);
  });

  it("reads cases by their ids through the _id index, exactly, testing the rest", async () => {
    const cases = [1, 2, 3, 4].map((n) => aCase(n));

    await db.collection("cases").insertMany(cases);

    const oidOf = (n) => ({ oid: cases[n - 1]._id.toHexString() });
    const { payload, finds } = await profiled("cases", () =>
      queryExplore(
        query({
          columns: [{ path: "_id" }, { path: "caseRef" }],
          where: {
            all: [
              {
                path: "_id",
                op: "in",
                values: [oidOf(1), oidOf(2), oidOf(3)],
              },
              { path: "currentStatus", op: "eq", values: ["IN_REVIEW"] },
            ],
          },
          window: true,
          positions: { "cw.cases": null },
        }),
      ),
    );

    expect(payload.read).toBe("exact");
    expect(payload.boxes[0].count).toEqual({ n: 2, capped: false });
    expect(
      payload.boxes[0].rows.map(({ key, cells }) => [key.i, cells]),
    ).toEqual(
      [1, 3].map((n) => [oidOf(n).oid, { c0: oidOf(n).oid, c1: `case-${n}` }]),
    );
    expect(finds).toEqual([
      {
        hint: { _id: 1 },
        ids: [1, 2, 3].map((n) => oidOf(n).oid).toSorted(),
      },
    ]);
  });

  it("reads events by their ids in both boxes, exactly", async () => {
    const outboxEvents = [1, 3].map((n) => anEvent(n, minutesAgo(n)));
    const inboxEvents = [2, 4].map((n) =>
      anEvent(n, minutesAgo(n).toISOString()),
    );

    await db.collection("outbox").insertMany(outboxEvents);
    await db.collection("inbox").insertMany(inboxEvents);

    const oidOf = ({ _id }) => ({ oid: _id.toHexString() });
    const asked = [outboxEvents[0], inboxEvents[1]].map(oidOf);
    const { payload, finds } = await profiled(["outbox", "inbox"], () =>
      queryExplore(
        query({
          source: "events",
          columns: [{ path: "_id" }, { path: "box" }],
          where: { path: "_id", op: "in", values: asked },
        }),
      ),
    );

    expect(payload.read).toBe("exact");
    expect(
      payload.boxes.map(({ id, rows, count }) => [
        id,
        rows.map(({ cells }) => cells),
        count.n,
      ]),
    ).toEqual([
      ["cw.outbox", [{ c0: oidOf(outboxEvents[0]).oid, c1: "outbox" }], 1],
      ["cw.inbox", [{ c0: oidOf(inboxEvents[1]).oid, c1: "inbox" }], 1],
    ]);
    expect(finds).toEqual(
      ["outbox", "inbox"].map(() => ({
        hint: { _id: 1 },
        ids: asked.map(({ oid }) => oid).toSorted(),
      })),
    );
  });

  it("reads a case's _id as its column, typed for GAS to merge in _id order", async () => {
    const cases = [1, 2, 3].map((n) => aCase(n));

    await db.collection("cases").insertMany(cases);

    const asked = query({
      columns: [{ path: "_id" }],
      orderBy: { path: "_id", fn: null, desc: true },
    });
    const { payload } = await queryExplore(asked);

    const hexes = cases.map(({ _id }) => _id.toHexString());

    expect(
      mergeExact(payload.boxes, asked).rows.map(({ cells, order }) => [
        cells.c0,
        order,
      ]),
    ).toEqual(hexes.toReversed().map((hex) => [hex, { o: hex }]));
  });

  it.each([
    ["a case's comments", "comments.text", "Spoke to the farmer"],
    ["a case's timeline", "timeline.createdBy", "caseworker-1"],
  ])("reads %s, as nothing stored is withheld", async (_, path, value) => {
    await db.collection("cases").insertMany([
      aCase(1, {
        comments: [{ type: "NOTE", text: "Spoke to the farmer" }],
        timeline: [{ eventType: "CASE_CREATED", createdBy: "caseworker-1" }],
      }),
      aCase(2),
    ]);

    const { payload } = await queryExplore(
      query({
        columns: [{ path: "caseRef" }, { path }],
        where: { path, op: "eq", values: [value] },
      }),
    );

    expect(payload.boxes[0].rows.map(({ cells }) => cells)).toEqual([
      { c0: "case-1", c1: [value] },
    ]);
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
