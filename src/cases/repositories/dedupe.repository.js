import { db } from "../../common/mongo-client.js";
import { DedupeGroupKey, keyName } from "../models/dedupe-group-key.js";
import { DEDUPE_NAMESPACE } from "../models/dedupe-label.js";

const storedPath = (value) => value.replace("$case.", "");
const scope = (caseType, config) => ({
  workflowCode: caseType,
  currentPhase: config.scope.phase,
  currentStage: config.scope.stage,
});
const projection = (config) => ({
  _id: 1,
  caseRef: 1,
  currentStatus: 1,
  createdAt: 1,
  labels: 1,
  businessName: "$" + storedPath(config.display.businessName),
});
const validKey = (entry) => {
  const value = "$" + storedPath(entry.value);
  return {
    $and: [
      { $in: [{ $type: value }, ["string", "int", "long", "double"]] },
      {
        $cond: [
          { $eq: [{ $type: value }, "string"] },
          { $ne: [{ $trim: { input: value } }, ""] },
          true,
        ],
      },
    ],
  };
};
export const findDedupeGroups = (caseType, config, visibleOnly, session) =>
  db
    .collection("cases")
    .aggregate(
      [
        { $match: scope(caseType, config) },
        { $match: { $expr: { $and: config.groupBy.map(validKey) } } },
        {
          $project: {
            ...projection(config),
            groupKey: Object.fromEntries(
              config.groupBy.map((entry) => [
                keyName(entry),
                "$" + storedPath(entry.value),
              ]),
            ),
          },
        },
        { $sort: { createdAt: 1, caseRef: 1 } },
        {
          $group: {
            _id: "$groupKey",
            cases: { $push: "$$ROOT" },
            activeCount: {
              $sum: {
                $cond: [
                  { $in: ["$currentStatus", config.scope.excludeStatuses] },
                  0,
                  1,
                ],
              },
            },
          },
        },
        ...(visibleOnly ? [{ $match: { activeCount: { $gte: 2 } } }] : []),
        { $project: { _id: 0, key: "$_id", cases: 1 } },
      ],
      { session },
    )
    .toArray();

export const findDedupeMembers = (key, config, session) =>
  db
    .collection("cases")
    .aggregate(
      [
        {
          $match: {
            ...scope(key.caseType, config),
            ...Object.fromEntries(
              config.groupBy.map((entry) => [
                storedPath(entry.value),
                { $eq: key.values[keyName(entry)] },
              ]),
            ),
          },
        },
        { $project: projection(config) },
        { $sort: { createdAt: 1, caseRef: 1 } },
      ],
      { session },
    )
    .toArray();

export const findGroupOwners = (caseType, groups, session) =>
  db
    .collection("case_groups")
    .find(
      {
        caseType,
        keyHash: {
          $in: groups.map(
            (group) => new DedupeGroupKey(caseType, group.key).hash,
          ),
        },
      },
      { session },
    )
    .toArray();

// Only duplicate-labelled cases are needed to follow historical edges. With
// rare duplicates this remains small; bounded graph queries are production work.
export const findDedupeReferences = (caseType, session) =>
  db
    .collection("cases")
    .find(
      {
        workflowCode: caseType,
        labels: {
          $elemMatch: { namespace: DEDUPE_NAMESPACE, code: "DUPLICATE" },
        },
      },
      { projection: { _id: 0, caseRef: 1, labels: 1 }, session },
    )
    .toArray();

export const saveGroupOwner = (assignment, session) =>
  db.collection("case_groups").updateOne(
    { caseType: assignment.key.caseType, keyHash: assignment.key.hash },
    {
      $set: {
        assignee: assignment.assignee,
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        key: assignment.key.values,
        createdAt: new Date().toISOString(),
      },
      $inc: { version: 1 },
    },
    { upsert: true, session },
  );

export const saveCaseLabel = (kase, event, session) =>
  db.collection("cases").updateOne(
    { _id: kase.objectId },
    {
      $set: { labels: kase.labels },
      $push: { timeline: { $each: [event], $position: 0 } },
    },
    { session },
  );
