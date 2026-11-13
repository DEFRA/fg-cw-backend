import { db } from "../../common/mongo-client.js";
import { groupHash, keyName } from "../models/dedupe-page.js";

export const findDedupeGroups = (caseType, config, visibleOnly, session) =>
  db
    .collection("cases")
    .aggregate(
      [
        {
          $match: {
            workflowCode: caseType,
            currentPhase: config.scope.phase,
            currentStage: config.scope.stage,
          },
        },
        {
          $set: {
            groupKey: Object.fromEntries(
              config.groupBy.map((entry) => [
                keyName(entry),
                `$${entry.value.replace("$case.", "")}`,
              ]),
            ),
          },
        },
        {
          $match: {
            $expr: {
              $and: config.groupBy.map((entry) => ({
                $and: [
                  {
                    $in: [
                      { $type: `$groupKey.${keyName(entry)}` },
                      ["string", "int", "long", "double"],
                    ],
                  },
                  { $ne: [`$groupKey.${keyName(entry)}`, ""] },
                ],
              })),
            },
          },
        },
        { $sort: { createdAt: 1, caseRef: 1 } },
        {
          $group: {
            _id: "$groupKey",
            cases: {
              $push: {
                _id: "$_id",
                caseRef: "$caseRef",
                createdAt: "$createdAt",
                currentStatus: "$currentStatus",
                labels: "$labels",
                payload: "$payload",
              },
            },
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

export const findGroupOwners = (caseType, pageKey, groups, session) =>
  db
    .collection("case_groups")
    .find(
      {
        caseType,
        pageKey,
        keyHash: {
          $in: groups.map((group) => groupHash(caseType, pageKey, group.key)),
        },
      },
      { session },
    )
    .toArray();

export const saveGroupOwner = (identity, assignee, session) =>
  db.collection("case_groups").updateOne(
    {
      caseType: identity.caseType,
      pageKey: identity.pageKey,
      keyHash: identity.keyHash,
    },
    {
      $set: { assignee, updatedAt: new Date().toISOString() },
      $setOnInsert: { key: identity.key, createdAt: new Date().toISOString() },
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
