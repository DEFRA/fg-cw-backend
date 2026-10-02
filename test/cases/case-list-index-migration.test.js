import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { up } from "../../migrations/20261002120000-add-case-list-index.js";

const INDEX_NAME = "createdAt_-1__id_-1";
const DAY_MS = 86_400_000;
const NOW = new Date("2026-10-02T12:00:00.000Z");

let client;
let db;
let cases;

const aCase = (index) => ({
  _id: new ObjectId(),
  caseRef: `CASE-LIST-INDEX-${index}`,
  createdAt: new Date(NOW.getTime() - index * (DAY_MS / 4)),
});

const keyPatterns = async () => (await cases.indexes()).map(({ key }) => key);

const accessedSince = async () => {
  const [stats] = await cases
    .aggregate([{ $indexStats: {} }, { $match: { name: INDEX_NAME } }])
    .toArray();

  return stats.accesses.since;
};

// The server's startup migrations have already built it.
const withoutTheIndex = async (callback) => {
  await cases.dropIndex(INDEX_NAME);

  try {
    await callback();
  } finally {
    await up(db);
  }
};

const stagesOf = (plan) => [
  plan.stage,
  ...(plan.inputStage ? stagesOf(plan.inputStage) : []),
  ...(plan.inputStages ?? []).flatMap(stagesOf),
];

const ixscanOf = (plan) =>
  plan.stage === "IXSCAN"
    ? plan
    : [plan.inputStage, ...(plan.inputStages ?? [])]
        .filter(Boolean)
        .map(ixscanOf)
        .find(Boolean);

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  cases = db.collection("cases");
});

afterAll(async () => {
  await client?.close(true);
});

describe("20261002120000-add-case-list-index", () => {
  it("indexes cases newest first with an _id tie-break", async () => {
    await withoutTheIndex(async () => {
      await up(db);

      expect(await keyPatterns()).toContainEqual({ createdAt: -1, _id: -1 });
    });
  });

  it("keeps the workflow filter index", async () => {
    await up(db);

    expect(await keyPatterns()).toContainEqual({
      workflowCode: 1,
      createdAt: -1,
      _id: -1,
    });
  });

  it("does not rebuild the index when it is already there", async () => {
    const since = await accessedSince();

    await up(db);

    expect(await accessedSince()).toEqual(since);
  });

  it("changes no case document", async () => {
    await withoutTheIndex(async () => {
      const docs = [aCase(0), aCase(1)];
      await cases.insertMany(docs);

      await up(db);

      expect(await cases.find().sort({ caseRef: 1 }).toArray()).toEqual(docs);
    });
  });

  it("serves a 7-day browse from the index with no in-memory sort", async () => {
    await cases.insertMany(Array.from({ length: 60 }, (_, i) => aCase(i)));
    await up(db);

    const explained = await cases
      .find({
        createdAt: {
          $gte: new Date(NOW.getTime() - 7 * DAY_MS),
          $lt: NOW,
        },
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(21)
      .explain("queryPlanner");

    const { winningPlan } = explained.queryPlanner;

    expect(stagesOf(winningPlan)).not.toContain("SORT");
    expect(ixscanOf(winningPlan).keyPattern).toEqual({
      createdAt: -1,
      _id: -1,
    });
  });
});
