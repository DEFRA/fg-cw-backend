/* eslint-disable complexity -- Direct transaction experiment; discarded after the spike. */
// THROWAWAY adapter: only call with the named scratch database below.
import { buildRows, planSave } from "./logic.js";
export const databaseName = "PROTOTYPE_fgp1594_wipe_me";
const name = (entry) => entry.name ?? entry.value.split(".").at(-1);

export const pipeline = (config, visibleOnly = true) => [
  {
    $match: {
      workflowCode: config.caseType,
      currentPhase: config.scope.phase,
      currentStage: config.scope.stage,
    },
  },
  {
    $set: {
      groupKey: Object.fromEntries(
        config.groupBy.map((entry) => [
          name(entry),
          `$${entry.value.replace("$case.", "")}`,
        ]),
      ),
      excluded: { $in: ["$currentStatus", config.scope.excludeStatuses] },
    },
  },
  {
    $match: {
      $expr: {
        $and: config.groupBy.map((entry) => ({
          $and: [
            {
              $in: [
                { $type: `$groupKey.${name(entry)}` },
                ["string", "int", "long", "double"],
              ],
            },
            { $ne: [`$groupKey.${name(entry)}`, ""] },
          ],
        })),
      },
    },
  },
  { $sort: { createdAt: 1, caseRef: 1 } },
  {
    $group: {
      _id: "$groupKey",
      cases: { $push: "$$ROOT" },
      activeCount: { $sum: { $cond: ["$excluded", 0, 1] } },
    },
  },
  ...(visibleOnly ? [{ $match: { activeCount: { $gte: 2 } } }] : []),
  { $project: { _id: 0, key: "$_id", cases: 1 } },
];

export const readRows = async (db, config, visibleOnly = true, session) => {
  const groups = await db
    .collection("cases")
    .aggregate(pipeline(config, visibleOnly), { session })
    .toArray();
  // Hashing after aggregation avoids server-side JavaScript. Batch owner lookup.
  const rows = await buildRows(groups, [], config, visibleOnly);
  const aggregates = await db
    .collection("case_groups")
    .find(
      {
        caseType: config.caseType,
        pageKey: config.pageKey,
        keyHash: { $in: rows.map((row) => row.keyHash) },
      },
      { session },
    )
    .toArray();
  return buildRows(groups, aggregates, config, visibleOnly);
};

export const saveGroup = async (
  client,
  db,
  config,
  hash,
  command,
  users,
  actor,
  injectFailure = false,
) => {
  return client.withSession((session) =>
    session.withTransaction(async () => {
      const row = (await readRows(db, config, false, session)).find(
        (item) => item.keyHash === hash,
      );
      if (!row) throw new Error("Group not found");
      const plan = planSave(row, command, users, config, actor);
      for (const { kase, nextLabel, event } of plan.changes) {
        const labels = (kase.labels ?? []).filter(
          (label) => label.namespace !== config.labels.namespace,
        );
        if (nextLabel) labels.push(nextLabel);
        await db.collection("cases").updateOne(
          { _id: kase._id },
          {
            $set: { labels },
            $push: { timeline: { $each: [event], $position: 0 } },
          },
          { session },
        );
      }
      if (injectFailure)
        throw new Error("Injected failure after labels, before owner");
      if (plan.ownerChanged) {
        await db.collection("case_groups").updateOne(
          { caseType: config.caseType, pageKey: config.pageKey, keyHash: hash },
          {
            $set: { assignee: plan.owner, updatedAt: plan.now },
            $setOnInsert: { key: row.key, createdAt: plan.now },
            $inc: { version: 1 },
          },
          { upsert: true, session },
        );
      }
      return {
        changedLabels: plan.changes.length,
        ownerChanged: plan.ownerChanged,
      };
    }),
  );
};
