// The ticket explicitly asks for evaluator and save validation tests.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  applyMemorySave,
  buildRows,
  canonical,
  compileConfig,
  functions,
  groupCases,
  keyHash,
  labelFor,
  labelOptions,
  planSave,
} from "./logic.js";
import { makeCase, seed, users } from "./seed.js";

const input = JSON.parse(
  await readFile(new URL("./config.json", import.meta.url)),
);
const config = compileConfig(input);
const fresh = () => ({ cases: seed(), aggregates: [] });
const rows = (state, cfg = config, visible = true) =>
  buildRows(groupCases(state.cases, cfg), state.aggregates, cfg, visible);
const target = async (state) =>
  (await rows(state)).find((row) => row.key.sbi === "244666513");
const command = (labels = {}, assignee = null) => ({ assignee, labels });
const notDuplicate = { code: "NOT_DUPLICATE" };

test("scope, grouping, oldest display, counts, sorting and missing keys", async () => {
  const state = fresh();
  const result = await rows(state);
  assert.deepEqual(
    result.map((row) => row.key.sbi),
    ["244666515", "244666514", "244666513"],
  );
  const row = await target(state);
  assert.equal(row.cases.length, 3);
  assert.equal(row.details.notSet, 2);
  assert.equal(row.details.excludedCount, 1);
  assert.equal(row.status.tag, "NOT_STARTED");
  assert.equal(row.columns.details[0].text, "SBI 244666513: Farm 244666513");
  state.cases.find(
    (kase) => kase.caseRef === "300242",
  ).payload.answers.applicant.business.name = "Changed name";
  assert.equal((await target(state)).details.businessName, "Farm 244666513");
});
test("configuration changes scope and composite grouping without logic changes", async () => {
  const cfg = compileConfig({
    ...input,
    groupBy: [
      ...input.groupBy,
      { name: "status", value: "$case.currentStatus" },
    ],
  });
  const state = fresh();
  assert.equal((await rows(state, cfg)).length, 3);
  assert.equal(
    (
      await rows(
        state,
        compileConfig({
          ...input,
          scope: { ...input.scope, stage: "REVIEW_OFFER" },
        }),
      )
    ).length,
    0,
  );
  state.cases.find((kase) => kase.caseRef === "300242").currentStatus =
    "ANOTHER_STATUS";
  assert.equal((await rows(state, cfg)).length, 2);
});
test("all evaluator functions, typed stable hashes and changed config keys", async () => {
  const state = fresh();
  let row = await target(state);
  assert.equal(functions.count(row.cases), 3);
  assert.equal(functions.first(row.cases, "$case.caseRef"), "300241");
  state.cases[0].labels = [{ namespace: "other", code: "NOT_DUPLICATE" }];
  assert.equal(functions.labelCount(row.cases, "NOT_DUPLICATE", config), 0);
  state.cases[0].labels.push({
    namespace: "duplicates",
    code: "NOT_DUPLICATE",
  });
  row = await target(state);
  assert.equal(
    functions.labelCount(row.activeCases, "NOT_DUPLICATE", config),
    1,
  );
  assert.equal(row.status.tag, "IN_PROGRESS");
  assert.equal(
    await keyHash(config, { a: "1", b: 2 }),
    await keyHash(config, { b: 2, a: "1" }),
  );
  assert.notEqual(
    await keyHash(config, { a: "1" }),
    await keyHash(config, { a: 1 }),
  );
  assert.notEqual(
    await keyHash(config, { a: 1 }),
    await keyHash({ ...config, pageKey: "other" }, { a: 1 }),
  );
  assert.notEqual(
    canonical({ code: "DUPLICATE", data: { duplicateOf: "1" } }),
    canonical({ code: "DUPLICATE", data: { duplicateOf: "2" } }),
  );
});
test("completion reopens on arrival, owner survives, only changed labels are audited", async () => {
  let state = fresh();
  state = applyMemorySave(
    state,
    await target(state),
    command({ 300241: notDuplicate }, "spike-user"),
    config,
    users,
  );
  assert.equal((await target(state)).status.tag, "IN_PROGRESS");
  state = applyMemorySave(
    state,
    await target(state),
    command(
      {
        300241: notDuplicate,
        300242: { code: "DUPLICATE", data: { duplicateOf: "300241" } },
      },
      "spike-user",
    ),
    config,
    users,
  );
  assert.equal((await target(state)).status.tag, "COMPLETED");
  assert.equal(state.cases[0].timeline.length, 1);
  assert.equal(state.cases[1].timeline[0].data.oldLabel, null);
  state.cases.push(makeCase("300260", "244666513"));
  assert.equal((await target(state)).status.tag, "IN_PROGRESS");
  assert.equal((await target(state)).owner.id, "spike-user");
  assert.equal(state.aggregates.length, 1);
  assert.equal("cases" in state.aggregates[0], false);
});
test("exclusion locks labels, preserves historical targets and hides summary only", async () => {
  let state = fresh();
  state = applyMemorySave(
    state,
    await target(state),
    command({
      300241: notDuplicate,
      300242: { code: "DUPLICATE", data: { duplicateOf: "300241" } },
    }),
    config,
    users,
  );
  state.cases[0].currentStatus = "APPLICATION_WITHDRAWN";
  assert.equal((await rows(state)).length, 2);
  const row = (await rows(state, config, false)).find(
    (item) => item.key.sbi === "244666513",
  );
  assert.equal(row.status.tag, "COMPLETED");
  assert.equal(row.cases.length, 3);
  assert.equal(labelOptions(row, row.cases[1], config).length, 2);
  assert.equal(
    planSave(
      row,
      command(
        { 300242: { code: "DUPLICATE", data: { duplicateOf: "300241" } } },
        "spike-user",
      ),
      users,
      config,
      "actor",
    ).changes.length,
    0,
  );
  assert.throws(
    () => planSave(row, command({ 300241: null }), users, config, "actor"),
    /active case/,
  );
});
test("invalid labels and owner are rejected before any mutation", async () => {
  const state = fresh();
  const before = structuredClone(state);
  const row = await target(state);
  const invalid = [
    command({}, "unknown"),
    command({ 300244: notDuplicate }),
    command({ 300243: null }),
    command({ 300241: { code: "BAD" } }),
    ...["300241", "300243", "300244", "missing"].map((duplicateOf) =>
      command({ 300241: { code: "DUPLICATE", data: { duplicateOf } } }),
    ),
    command({ 300241: { code: "DUPLICATE" } }),
    command({
      300241: { code: "NOT_DUPLICATE", data: { duplicateOf: "300242" } },
    }),
    { labels: {} },
    { assignee: null, labels: [] },
  ];
  for (const submission of invalid)
    assert.throws(() => applyMemorySave(state, row, submission, config, users));
  assert.deepEqual(state, before);
});
test("clearing a label keeps other namespaces and adds one timeline entry", async () => {
  let state = fresh();
  state.cases[0].labels = [{ namespace: "other", code: "OTHER" }];
  state = applyMemorySave(
    state,
    await target(state),
    command({ 300241: notDuplicate }),
    config,
    users,
  );
  state = applyMemorySave(
    state,
    await target(state),
    command({ 300241: null }),
    config,
    users,
  );
  assert.equal(labelFor(state.cases[0], config), null);
  assert.equal(state.cases[0].labels[0].namespace, "other");
  assert.equal(state.cases[0].timeline.length, 2);
  assert.equal(state.aggregates.length, 0);
});
test("bad configuration fails before serving requests", () => {
  for (const expression of [
    "function:unknown(@.cases)",
    "function:count(@.missing)",
    "function:first(@.cases, '$case.payload.typo')",
    "function:count(@.cases, 'extra')",
    "@.key.typo",
    "$group.typo",
  ]) {
    const broken = structuredClone(input);
    broken.data.details.sbi = expression;
    assert.throws(() => compileConfig(broken));
  }
  assert.throws(() =>
    compileConfig({ ...input, groupBy: [{ value: "$case.payload.typo" }] }),
  );
  assert.throws(() =>
    compileConfig({
      ...input,
      groupBy: [{ ...input.groupBy[0], normalise: "uppercase" }],
    }),
  );
});
