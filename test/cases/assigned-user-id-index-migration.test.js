import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { up } from "../../migrations/20261117121111-add-assigned-user-id-index.js";

const INDEX_NAME = "assignedUserId_1_createdAt_-1__id_-1";
const KEY_PATTERN = { assignedUserId: 1, createdAt: -1, _id: -1 };
const NOW = new Date("2026-11-17T12:00:00.000Z");
const ME = "60c72b2f9b1e8d001c8e4f5a";
const SOMEONE_ELSE = "60c72b2f9b1e8d001c8e4f5b";

let client;
let db;
let cases;

const aCase = (index, assignedUserId) => ({
  _id: new ObjectId(),
  caseRef: `ASSIGNED-USER-INDEX-${String(index).padStart(3, "0")}`,
  workflowCode: index % 2 ? "woodland" : "pigs-might-fly",
  assignedUserId,
  createdAt: new Date(NOW.getTime() - index * 60_000),
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

describe("20261117121111-add-assigned-user-id-index", () => {
  it("indexes cases by assigned user, newest first with an _id tie-break", async () => {
    await withoutTheIndex(async () => {
      await up(db);

      expect(await keyPatterns()).toContainEqual(KEY_PATTERN);
    });
  });

  it("keeps the case list index", async () => {
    await up(db);

    expect(await keyPatterns()).toContainEqual({ createdAt: -1, _id: -1 });
  });

  it("does not rebuild the index when it is already there", async () => {
    const since = await accessedSince();

    await up(db);

    expect(await accessedSince()).toEqual(since);
  });

  it("changes no case document", async () => {
    await withoutTheIndex(async () => {
      const docs = [aCase(0, ME), aCase(1, null)];
      await cases.insertMany(docs);

      await up(db);

      expect(await cases.find().sort({ caseRef: 1 }).toArray()).toEqual(docs);
    });
  });

  it("serves a user's cases from the index with no in-memory sort", async () => {
    await cases.insertMany([
      ...Array.from({ length: 30 }, (_, i) => aCase(i, ME)),
      ...Array.from({ length: 30 }, (_, i) => aCase(30 + i, SOMEONE_ELSE)),
      ...Array.from({ length: 30 }, (_, i) => aCase(60 + i, null)),
    ]);
    await up(db);

    const explained = await cases
      .find({
        workflowCode: { $in: ["woodland", "pigs-might-fly"] },
        assignedUserId: ME,
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(21)
      .explain("queryPlanner");

    const { winningPlan } = explained.queryPlanner;

    expect(stagesOf(winningPlan)).not.toContain("SORT");
    expect(ixscanOf(winningPlan).keyPattern).toEqual(KEY_PATTERN);
  });
});
