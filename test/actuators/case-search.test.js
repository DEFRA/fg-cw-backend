import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  caseListBySeriesCursor,
  caseListPageOptions,
  seriesContainingCursor,
} from "../../src/cases/repositories/case/admin-case-query.js";
import { paginate } from "../../src/common/paginate.js";
import { searchCases, seedCaseReaderToken } from "../helpers/actuators.js";
import { CASE_READER_CLIENT, SERVICE_TOKEN } from "../helpers/service-token.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../helpers/operator.js";

let client;
let db;
let cases;

const DAY_MS = 86_400_000;
const NOW = new Date("2026-10-02T12:00:00.000Z");

const daysAgo = (days) => new Date(NOW.getTime() - days * DAY_MS);

const aCase = (caseRef, overrides = {}) => ({
  _id: new ObjectId(),
  caseRef,
  workflowCode: "frps",
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW",
  currentStatus: "NEW",
  closed: false,
  closedAt: null,
  createdAt: NOW,
  payload: { answers: { opaque: true } },
  comments: [],
  timeline: [],
  ...overrides,
});

const aSeries = (workflowCode, caseRefs) => ({
  _id: new ObjectId(),
  workflowCode,
  caseRefs,
  latestCaseRef: caseRefs.at(-1),
  latestCaseId: new ObjectId().toHexString(),
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
});

const refsOf = (response) =>
  response.payload.cases.map(({ ref }) => ref.caseRef);

const auditRows = () =>
  db
    .collection("outbox")
    .find({ segregationRef: "admin-search-cases" })
    .toArray();

const stagesOf = (plan) => [
  plan,
  ...(plan.inputStage ? stagesOf(plan.inputStage) : []),
  ...(plan.inputStages ?? []).flatMap(stagesOf),
];

const winningStages = async (cursor) =>
  stagesOf((await cursor.explain("queryPlanner")).queryPlanner.winningPlan);

const indexesUsed = async (cursor) =>
  (await winningStages(cursor))
    .filter((stage) => stage.stage === "IXSCAN")
    .map((stage) => stage.keyPattern);

// The find a browse page runs, built by the real `paginate` and replayed on
// the real collection so it can be explained.
const browsePageCursor = async (query) => {
  let read;
  const recorder = {
    find: (filter, options) => {
      read = { filter, options };
      const chain = {
        project: (project) => Object.assign(read, { project }) && chain,
        sort: (sort) => Object.assign(read, { sort }) && chain,
        limit: (limit) => Object.assign(read, { limit }) && chain,
        toArray: async () => [],
      };
      return chain;
    },
  };

  await paginate(recorder, caseListPageOptions(query));

  return cases
    .find(read.filter, read.options)
    .project(read.project)
    .sort(read.sort)
    .limit(read.limit);
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  cases = db.collection("cases");
  await seedCaseReaderToken(db);
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await db
    .collection("workflows")
    .insertMany([{ code: "frps" }, { code: "woodland" }]);
});

describe("POST /actuators/cases/search, browse", () => {
  beforeEach(async () => {
    await cases.insertMany(
      Array.from({ length: 25 }, (_, i) =>
        aCase(`case-${String(i).padStart(2, "0")}`, {
          createdAt: daysAgo(i),
          workflowCode: i % 5 === 0 ? "woodland" : "frps",
        }),
      ),
    );
  });

  it("answers 20 cases newest first, a cursor, a total and the codes", async () => {
    const response = await searchCases({});

    expect(refsOf(response)).toEqual(
      Array.from(
        { length: 20 },
        (_, i) => `case-${String(i).padStart(2, "0")}`,
      ),
    );
    expect(response.payload.pagination.hasNextPage).toBe(true);
    expect(response.payload.total).toEqual({ count: 25, capped: false });
    expect(response.payload.workflowCodes.sort()).toEqual(["frps", "woodland"]);
    expect(response.payload.cases[0]).toEqual({
      ref: { caseRef: "case-00", workflowCode: "woodland" },
      position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
      closed: false,
      closedAt: null,
      createdAt: NOW.toISOString(),
      replaced: false,
    });
  });

  it("marks a row replaced when a later case in its workflow's series exists", async () => {
    await db
      .collection("case_series")
      .insertMany([
        aSeries("frps", ["case-03", "case-02", "case-01"]),
        aSeries("woodland", ["case-10", "case-00"]),
      ]);
    await cases.insertOne(
      aCase("case-03", { workflowCode: "woodland", createdAt: daysAgo(30) }),
    );

    const response = await searchCases({});
    const flags = Object.fromEntries(
      response.payload.cases.map(({ ref, replaced }) => [
        `${ref.workflowCode}/${ref.caseRef}`,
        replaced,
      ]),
    );

    expect(flags).toMatchObject({
      "woodland/case-00": false,
      "frps/case-01": false,
      "frps/case-02": true,
      "frps/case-03": true,
      "frps/case-04": false,
      "woodland/case-10": true,
    });
    expect(
      (await searchCases({ workflowCode: "woodland" })).payload.cases.map(
        ({ ref, replaced }) => [ref.caseRef, replaced],
      ),
    ).toEqual([
      ["case-00", false],
      ["case-05", false],
      ["case-10", true],
      ["case-15", false],
      ["case-20", false],
      ["case-03", false],
    ]);
  });

  it("continues from the cursor with no gap or repeat", async () => {
    const first = await searchCases({});
    const next = await searchCases({
      cursor: first.payload.pagination.endCursor,
    });

    expect([...refsOf(first), ...refsOf(next)]).toEqual(
      Array.from(
        { length: 25 },
        (_, i) => `case-${String(i).padStart(2, "0")}`,
      ),
    );
    expect(next.payload.pagination.hasNextPage).toBe(false);
    expect(next.payload).not.toHaveProperty("total");
    expect(next.payload).not.toHaveProperty("workflowCodes");
  });

  it("breaks a createdAt tie by _id", async () => {
    await cases.deleteMany({});
    const low = aCase("tie-low", {
      _id: new ObjectId("000000000000000000000001"),
    });
    const high = aCase("tie-high", {
      _id: new ObjectId("000000000000000000000002"),
    });
    await cases.insertMany([low, high]);

    expect(refsOf(await searchCases({}))).toEqual(["tie-high", "tie-low"]);
  });

  it("combines the workflow filter with the range", async () => {
    const response = await searchCases({
      workflowCode: "frps",
      from: daysAgo(9).toISOString(),
      to: daysAgo(2).toISOString(),
    });

    expect(refsOf(response)).toEqual([
      "case-02",
      "case-03",
      "case-04",
      "case-06",
      "case-07",
      "case-08",
      "case-09",
    ]);
    expect(response.payload.total).toEqual({ count: 7, capped: false });
  });

  it("returns no row field from inside the payload", async () => {
    const [row] = (await searchCases({})).payload.cases;

    expect(Object.keys(row).sort()).toEqual([
      "closed",
      "closedAt",
      "createdAt",
      "position",
      "ref",
      "replaced",
    ]);
  });
});

describe("POST /actuators/cases/search, ref search", () => {
  beforeEach(async () => {
    await cases.insertMany([
      aCase("chain-1", { createdAt: daysAgo(30) }),
      aCase("chain-2", { createdAt: daysAgo(20) }),
      aCase("chain-3", { createdAt: daysAgo(10) }),
      aCase("chain-2", { workflowCode: "woodland", createdAt: daysAgo(5) }),
      aCase("loner", { createdAt: daysAgo(1) }),
    ]);
    await db
      .collection("case_series")
      .insertOne(aSeries("frps", ["chain-1", "chain-2", "chain-3"]));
  });

  it("answers the searched ref's whole series, on one page", async () => {
    const response = await searchCases({ ref: "chain-1" });

    expect(refsOf(response)).toEqual(["chain-3", "chain-2", "chain-1"]);
    expect(response.payload.pagination).toEqual({
      endCursor: null,
      hasNextPage: false,
    });
    expect(response.payload.total).toEqual({ count: 3, capped: false });
  });

  it("marks every member but the series' latest replaced", async () => {
    const response = await searchCases({ ref: "chain-2" });

    expect(
      response.payload.cases.map(({ ref, replaced }) => [
        `${ref.workflowCode}/${ref.caseRef}`,
        replaced,
      ]),
    ).toEqual([
      ["woodland/chain-2", false],
      ["frps/chain-3", false],
      ["frps/chain-2", true],
      ["frps/chain-1", true],
    ]);
  });

  it("adds the same ref under another workflow, which is outside the series", async () => {
    const response = await searchCases({ ref: "CHAIN-2" });

    expect(
      response.payload.cases.map(
        ({ ref }) => `${ref.workflowCode}/${ref.caseRef}`,
      ),
    ).toEqual([
      "woodland/chain-2",
      "frps/chain-3",
      "frps/chain-2",
      "frps/chain-1",
    ]);
  });

  it("narrows the match by workflow and range", async () => {
    const response = await searchCases({
      ref: "chain-2",
      workflowCode: "frps",
      from: daysAgo(25).toISOString(),
    });

    expect(refsOf(response)).toEqual(["chain-3", "chain-2"]);
  });

  it("finds a case that is in no series", async () => {
    expect(refsOf(await searchCases({ ref: "loner" }))).toEqual(["loner"]);
  });

  it("refuses a ref with a cursor", async () => {
    await expect(searchCases({ ref: "loner", cursor: "eyJ9" })).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });
});

describe("POST /actuators/cases/search, access and audit", () => {
  it("answers 403 to a client other than fg-gas-backend", async () => {
    await expect(
      searchCases({}, { authorization: `Bearer ${SERVICE_TOKEN}` }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("answers 401 with no token", async () => {
    await expect(searchCases({}, { authorization: null })).rejects.toThrow(
      "Response Error: 401 Unauthorized",
    );
  });

  it("answers 400 without the operator's id", async () => {
    await expect(searchCases({}, { "x-actor-id": "" })).rejects.toThrow(
      "Response Error: 400 Bad Request",
    );
  });

  it("commits one FIND_CASES row naming the operator, with 0706", async () => {
    await cases.insertOne(aCase("audited"));

    await searchCases({ workflowCode: "frps" }, { "x-search-repeat": "1" });

    const rows = await auditRows();

    expect(rows).toHaveLength(1);
    expect(rows[0].event).toMatchObject({
      user: OPERATOR_ID,
      security: { pmccode: "0706" },
      audit: {
        entities: [
          { entity: "CASE", action: "FIND_CASES", entityid: "search" },
        ],
        status: "SUCCESS",
        details: {
          security: { actor: { id: OPERATOR_ID, name: OPERATOR_NAME } },
          caller: CASE_READER_CLIENT,
          mode: "browse",
          workflowCode: "frps",
          page: "first",
          resultCount: 1,
          total: { count: 1, capped: false },
          repeat: true,
        },
      },
    });
  });
});

describe("POST /actuators/cases/search, writes", () => {
  it.each([
    ["a browse", {}],
    ["a ref search", { ref: "chain-1" }],
  ])("writes nothing to the cases or series on %s", async (_name, query) => {
    await cases.insertMany([
      aCase("chain-1", { createdAt: daysAgo(2) }),
      aCase("chain-2", { createdAt: daysAgo(1) }),
    ]);
    await db
      .collection("case_series")
      .insertOne(aSeries("frps", ["chain-1", "chain-2"]));
    const snapshot = async () => ({
      cases: await cases.find().sort({ _id: 1 }).toArray(),
      series: await db.collection("case_series").find().toArray(),
    });
    const before = await snapshot();

    await searchCases(query);

    expect(await snapshot()).toEqual(before);
  });
});

describe("POST /actuators/cases/search, capped total", () => {
  it("counts to 10,000 and says when there are more", async () => {
    await cases.insertMany(
      Array.from({ length: 10_001 }, (_, i) =>
        aCase(`bulk-${i}`, { createdAt: new Date(NOW.getTime() - i * 1000) }),
      ),
    );

    const response = await searchCases({});

    expect(response.payload.total).toEqual({ count: 10_000, capped: true });
    expect(response.payload.cases).toHaveLength(20);
  });
});

describe("query plans", () => {
  const FROM = daysAgo(2).toISOString();
  const TO = daysAgo(1).toISOString();
  const SERIES_REFS = ["plan-1", "plan-3", "plan-5"];

  // Most cases fall outside the range, so a plan that walks a sort index over
  // the range is cheap enough to tempt the planner.
  beforeEach(async () => {
    await cases.insertMany(
      Array.from({ length: 5000 }, (_, i) =>
        aCase(`plan-${i}`, {
          workflowCode: i % 2 ? "frps" : "woodland",
          createdAt:
            i < 50
              ? new Date(daysAgo(2).getTime() + i * 60_000)
              : daysAgo(10 + i / 100),
        }),
      ),
    );
    await db.collection("case_series").insertOne(aSeries("frps", SERIES_REFS));
  });

  describe.each([
    ["a browse", {}, { createdAt: -1, _id: -1 }],
    ["a ranged browse", { from: FROM, to: TO }, { createdAt: -1, _id: -1 }],
    [
      "a ranged workflow browse",
      { workflowCode: "frps", from: FROM, to: TO },
      { workflowCode: 1, createdAt: -1, _id: -1 },
    ],
  ])("%s", (_name, query, index) => {
    it("reads its first page from its index with no in-memory sort", async () => {
      const stages = await winningStages(await browsePageCursor(query));

      expect(stages.map(({ stage }) => stage)).not.toContain("SORT");
      expect(await indexesUsed(await browsePageCursor(query))).toEqual([index]);
    });

    it("reads its next page from the same index with no in-memory sort", async () => {
      const first = await paginate(cases, caseListPageOptions(query));
      const next = await browsePageCursor({
        ...query,
        cursor: first.pagination.endCursor,
      });

      const stages = await winningStages(next);

      expect(stages.map(({ stage }) => stage)).not.toContain("SORT");
      expect(await indexesUsed(next)).toEqual([index]);
    });
  });

  it.each([
    ["from", { from: FROM }],
    ["to", { to: TO }],
    ["from and to", { from: FROM, to: TO }],
    ["from with a workflow", { from: FROM, workflowCode: "frps" }],
    ["to with a workflow", { to: TO, workflowCode: "frps" }],
    [
      "from and to with a workflow",
      { from: FROM, to: TO, workflowCode: "frps" },
    ],
    ["no range", {}],
    ["a workflow alone", { workflowCode: "frps" }],
  ])(
    "keeps a ref search with %s on the caseRef index",
    async (_name, query) => {
      const used = await indexesUsed(
        caseListBySeriesCursor(
          cases,
          {
            ref: "plan-3",
            series: [{ workflowCode: "frps", caseRefs: SERIES_REFS }],
            ...query,
          },
          { limit: 201, maxTimeMS: 5000 },
        ),
      );

      // One branch for the seeded series and one for the bare ref.
      expect(used).toEqual([{ caseRef: 1 }, { caseRef: 1 }]);
    },
  );

  it("reads a page's series in one read on the caseRefs index", async () => {
    await db
      .collection("case_series")
      .insertMany(
        Array.from({ length: 500 }, (_, i) =>
          aSeries(i % 2 ? "frps" : "woodland", [`other-${i}`, `other-${i}-r`]),
        ),
      );
    const page = Array.from({ length: 20 }, (_, i) => `plan-${i}`);
    const cursor = () =>
      seriesContainingCursor(db.collection("case_series"), page, {
        maxTimeMS: 5000,
      });

    expect(await indexesUsed(cursor())).toEqual([{ caseRefs: 1 }]);
    expect(await cursor().toArray()).toEqual([
      {
        workflowCode: "frps",
        caseRefs: SERIES_REFS,
        latestCaseRef: "plan-5",
      },
    ]);
  });
});
