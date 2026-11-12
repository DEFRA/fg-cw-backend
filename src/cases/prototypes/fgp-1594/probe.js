// THROWAWAY evidence runner. No socket/listener or production DB/config writes.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";
import { createApi } from "./api.js";
import { buildRows, compileConfig, groupCases } from "./logic.js";
import { databaseName, pipeline, readRows, saveGroup } from "./mongo.js";
import { makeCase, seed, users } from "./seed.js";

const config = compileConfig(
  JSON.parse(await readFile(new URL("./config.json", import.meta.url))),
);
const client = new MongoClient(
  process.env.SPIKE_MONGO_URI ??
    "mongodb://127.0.0.1:27017/?directConnection=true",
  { serverSelectionTimeoutMS: 3000 },
);
const db = client.db(`${databaseName}_${randomUUID().slice(0, 8)}`);
const base = `/case-types/${config.caseType}/pages/${config.pageKey}`;
const report = (message) => process.stdout.write(`${message}\n`);
let server;
try {
  await client.connect();
  report(`Scratch database: ${db.databaseName} (removed at exit)`);
  await db.collection("cases").insertMany(seed());
  await db
    .collection("case_groups")
    .createIndex({ caseType: 1, pageKey: 1, keyHash: 1 }, { unique: true });
  await db
    .collection("cases")
    .createIndex({ workflowCode: 1, currentPhase: 1, currentStage: 1 });
  const store = {
    rows: (visible) => readRows(db, config, visible),
    save: (hash, command) =>
      saveGroup(client, db, config, hash, command, users, "spike-user"),
  };
  server = createApi(config, store, users);
  const request = async (method, url, payload, status = 200) => {
    const response = await server.inject({
      method,
      url,
      ...(payload && { payload }),
    });
    assert.equal(response.statusCode, status, response.payload);
    return response.result;
  };
  const summary = () => request("GET", base);
  assert.equal((await summary()).heading, "0 of 3 issues completed");
  const row = (await store.rows(true)).find(
    (item) => item.key.sbi === "244666513",
  );
  const url = `${base}/groups/${row.keyHash}`;
  assert.equal((await request("GET", url)).cases.length, 3);
  assert.deepEqual(
    (await store.rows(true)).map((item) => item.key),
    (await buildRows(groupCases(seed(), config), [], config)).map(
      (item) => item.key,
    ),
  );
  report(
    "PASS Mongo aggregation agrees with memory; GET summary/detail contract",
  );
  const composite = compileConfig({
    ...config,
    groupBy: [
      ...config.groupBy,
      { name: "status", value: "$case.currentStatus" },
    ],
  });
  assert.equal((await readRows(db, composite)).length, 3);
  assert.equal(
    (
      await readRows(
        db,
        compileConfig({
          ...config,
          scope: { ...config.scope, stage: "REVIEW_OFFER" },
        }),
      )
    ).length,
    0,
  );
  report("PASS configuration-only composite key and scope changes");
  const command = {
    assignee: "spike-user",
    labels: {
      300241: { code: "NOT_DUPLICATE" },
      300242: { code: "DUPLICATE", data: { duplicateOf: "300241" } },
    },
  };
  await assert.rejects(
    saveGroup(
      client,
      db,
      config,
      row.keyHash,
      command,
      users,
      "spike-user",
      true,
    ),
    /Injected failure/,
  );
  assert.equal(await db.collection("case_groups").countDocuments(), 0);
  assert.equal(
    (await db.collection("cases").findOne({ caseRef: "300241" })).timeline
      .length,
    0,
  );
  assert.equal(
    (await db.collection("cases").findOne({ caseRef: "300242" })).labels.length,
    0,
  );
  report(
    "PASS transaction rolls back labels, timeline and owner on injected failure",
  );
  await request("PUT", url, {
    ...command,
    labels: { 300241: command.labels["300241"] },
  });
  assert.equal(
    (await store.rows(true)).find((item) => item.keyHash === row.keyHash).status
      .tag,
    "IN_PROGRESS",
  );
  await request("PUT", url, command);
  assert.equal((await summary()).heading, "1 of 3 issues completed");
  assert.equal((await request("PUT", url, command)).changedLabels, 0);
  assert.equal(
    (await db.collection("cases").findOne({ caseRef: "300241" })).timeline
      .length,
    1,
  );
  report(
    "PASS PUT completion, owner persistence and unchanged label has no timeline write",
  );
  await db.collection("cases").insertOne(makeCase("300260", "244666513"));
  assert.equal((await summary()).heading, "0 of 3 issues completed");
  assert.equal((await request("GET", url)).owner.id, "spike-user");
  await db
    .collection("cases")
    .updateOne(
      { caseRef: "300241" },
      { $set: { currentStatus: "APPLICATION_WITHDRAWN" } },
    );
  const detail = await request("GET", url);
  assert.equal(
    detail.cases.find((kase) => kase.caseRef === "300241").excluded,
    true,
  );
  assert.equal(
    detail.cases
      .find((kase) => kase.caseRef === "300242")
      .options.some((option) => option.label?.data?.duplicateOf === "300241"),
    false,
  );
  await request("PUT", url, {
    assignee: "spike-user",
    labels: { 300242: command.labels["300242"] },
  });
  await request(
    "PUT",
    url,
    {
      assignee: null,
      labels: {
        300260: { code: "DUPLICATE", data: { duplicateOf: "300241" } },
      },
    },
    400,
  );
  await request("PUT", url, { assignee: null, labels: { 300241: null } }, 400);
  await db
    .collection("cases")
    .updateOne(
      { caseRef: "300260" },
      { $set: { currentStatus: "APPLICATION_REJECTED" } },
    );
  assert.equal((await summary()).total, 2);
  assert.equal((await request("GET", url)).cases.length, 4);
  report(
    "PASS arrival reopens; exclusions lock, preserve history and hide summary only",
  );
  const explain = await db
    .collection("cases")
    .aggregate(pipeline(config))
    .explain("executionStats");
  // Tiny synthetic seed: evidence of index compatibility, NOT a load benchmark.
  report(
    `PASS aggregation explain available (${JSON.stringify(explain).length} bytes); no scale claim`,
  );
} finally {
  if (server) await server.stop();
  // Only this run's generated database can be removed.
  if (client.topology?.isConnected()) await db.dropDatabase();
  await client.close();
}
