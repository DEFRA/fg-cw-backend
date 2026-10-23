import { FetchStatus } from "../src/common/fetch-status.js";
import { logger } from "../src/common/logger.js";

// Gives every case `originalConfigVersion` and `currentConfigVersion` and drops
// the legacy `configVersion`, so the Cases list and the case page read the same
// version. A case missing one version takes it from the legacy one, or else the
// other. A case with no version at all takes `0.0.0` and its workflow's newest
// version that resolves, as `20260806100000-remove-sentinel-config-versions.js`
// chose one, when that version's stored definition holds everything the case
// page reads from it: the case's position, its current stage's task groups,
// and the phase, stage, status or task group of each timeline entry. A case
// pinned to its current version is not checked against it again.
//
// A case whose workflow has no such version is left unversioned on purpose, so
// it still opens on `0.0.0`, and its workflow code logged as a warning with a
// count: CW no longer holds `0.0.0` as a current version, and failing here
// would stop CW starting.

const legacy = {
  $or: [
    { configVersion: { $exists: true } },
    { currentConfigVersion: null, originalConfigVersion: { $ne: null } },
    { originalConfigVersion: null, currentConfigVersion: { $ne: null } },
  ],
};

const fromLegacy = [
  {
    $set: {
      originalConfigVersion: {
        $ifNull: [
          "$originalConfigVersion",
          { $ifNull: ["$configVersion", "$currentConfigVersion"] },
        ],
      },
      currentConfigVersion: {
        $ifNull: [
          "$currentConfigVersion",
          { $ifNull: ["$configVersion", "$originalConfigVersion"] },
        ],
      },
    },
  },
  { $unset: "configVersion" },
];

const versionless = { currentConfigVersion: null };

const newestActiveVersion = async (configVersions, workflowCode) => {
  const [newest] = await configVersions
    .find({
      grantCode: workflowCode,
      status: "active",
      version: { $ne: "0.0.0" },
      fetchStatus: { $ne: FetchStatus.PermanentError },
    })
    .sort({ major: -1, minor: -1, patch: -1 })
    .limit(1)
    .toArray();

  return newest?.version ?? null;
};

const key = (...codes) => JSON.stringify(codes);

const referencesOf = async (workflows, code, version) => {
  const workflow = await workflows.findOne(
    { code, version },
    {
      projection: {
        "phases.code": 1,
        "phases.stages.code": 1,
        "phases.stages.statuses.code": 1,
        "phases.stages.taskGroups.code": 1,
      },
    },
  );

  return new Set(
    (workflow?.phases ?? []).flatMap((phase) => [
      key("phase", phase.code),
      ...phase.stages.flatMap((stage) => [
        ...stage.statuses.map((status) =>
          key("status", phase.code, stage.code, status.code),
        ),
        ...stage.taskGroups.map((taskGroup) =>
          key("taskGroup", phase.code, stage.code, taskGroup.code),
        ),
      ]),
    ]),
  );
};

const timelineReferences = ({ eventType, data }) => {
  const { phaseCode, stageCode, statusCode, taskGroupCode } = data ?? {};

  switch (eventType) {
    case "CASE_STATUS_CHANGED":
    case "STAGE_COMPLETED":
      return [key("status", phaseCode, stageCode, statusCode)];
    case "PHASE_COMPLETED":
      return [key("phase", phaseCode)];
    case "TASK_COMPLETED":
    case "TASK_UPDATED":
      return [key("taskGroup", phaseCode, stageCode, taskGroupCode)];
    default:
      return [];
  }
};

const caseReferences = (kase) => {
  const { currentPhase, currentStage, currentStatus } = kase;
  const taskGroups =
    kase.phases
      ?.find((phase) => phase.code === currentPhase)
      ?.stages?.find((stage) => stage.code === currentStage)?.taskGroups ?? [];

  return [
    key("status", currentPhase, currentStage, currentStatus),
    ...taskGroups.map((taskGroup) =>
      key("taskGroup", currentPhase, currentStage, taskGroup.code),
    ),
    ...(kase.timeline ?? []).flatMap(timelineReferences),
  ];
};

const readableCaseIds = async (cases, workflowCode, references) => {
  const ids = [];
  const candidates = cases.find(
    { ...versionless, workflowCode },
    {
      projection: {
        currentPhase: 1,
        currentStage: 1,
        currentStatus: 1,
        "phases.code": 1,
        "phases.stages.code": 1,
        "phases.stages.taskGroups.code": 1,
        "timeline.eventType": 1,
        "timeline.data": 1,
      },
    },
  );

  for await (const kase of candidates) {
    if (caseReferences(kase).every((reference) => references.has(reference))) {
      ids.push(kase._id);
    }
  }

  return ids;
};

const giveVersions = async (db, cases) => {
  let modified = 0;

  for (const workflowCode of await cases.distinct(
    "workflowCode",
    versionless,
  )) {
    const version = await newestActiveVersion(
      db.collection("config_versions"),
      workflowCode,
    );
    const references = version
      ? await referencesOf(db.collection("workflows"), workflowCode, version)
      : new Set();
    const ids =
      references.size > 0
        ? await readableCaseIds(cases, workflowCode, references)
        : [];

    if (ids.length > 0) {
      const { modifiedCount } = await cases.updateMany(
        { ...versionless, _id: { $in: ids } },
        {
          $set: {
            originalConfigVersion: "0.0.0",
            currentConfigVersion: version,
          },
        },
      );
      modified += modifiedCount;
    }
  }

  return modified;
};

const warnUnversioned = async (cases) => {
  const unversioned = await cases
    .aggregate([
      { $match: versionless },
      { $group: { _id: "$workflowCode", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  if (unversioned.length > 0) {
    const counts = unversioned.map(({ _id, count }) => `${_id} (${count})`);

    logger.warn(
      `Cases left without a config version, as their workflow has no version that holds their position and history: ${counts.join(", ")}`,
    );
  }
};

export const up = async (db) => {
  const cases = db.collection("cases");

  const { modifiedCount } = await cases.updateMany(legacy, fromLegacy);
  const given = await giveVersions(db, cases);

  logger.info(
    `Normalised ${modifiedCount} legacy or partly versioned and ${given} versionless case config versions`,
  );

  await warnUnversioned(cases);
};
