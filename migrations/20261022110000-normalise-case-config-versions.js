import { FetchStatus } from "../src/common/fetch-status.js";
import { logger } from "../src/common/logger.js";

// Gives every case `originalConfigVersion` and `currentConfigVersion` and drops
// the legacy `configVersion`, so the Cases list and the case page read the same
// version. A case missing one version takes it from the legacy one, or else the
// other. A case with no version at all takes `0.0.0` and its workflow's newest
// version that resolves, as `20260806100000-remove-sentinel-config-versions.js`
// chose one, when that version's stored definition holds everything the case
// page reads from it: the case's position, the same task groups in its current
// stage as the version's, the phase, stage, status or task group of each
// timeline entry, and the position of every case in its series. A case pinned
// to its current version is not checked against it again.
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

const definitionOf = async (workflows, code, version) => {
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

  const phases = workflow?.phases ?? [];
  const stages = phases.flatMap((phase) =>
    phase.stages.map((stage) => ({ phase: phase.code, stage })),
  );

  return {
    references: new Set([
      ...phases.map((phase) => key("phase", phase.code)),
      ...stages.flatMap(({ phase, stage }) => [
        ...stage.statuses.map((status) =>
          key("status", phase, stage.code, status.code),
        ),
        ...stage.taskGroups.map((taskGroup) =>
          key("taskGroup", phase, stage.code, taskGroup.code),
        ),
      ]),
    ]),
    taskGroupsOf: new Map(
      stages.map(({ phase, stage }) => [
        key(phase, stage.code),
        stage.taskGroups.map((taskGroup) => taskGroup.code),
      ]),
    ),
  };
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

const currentTaskGroupsOf = ({ phases, currentPhase, currentStage }) =>
  (
    phases
      ?.find((phase) => phase.code === currentPhase)
      ?.stages?.find((stage) => stage.code === currentStage)?.taskGroups ?? []
  ).map((taskGroup) => taskGroup.code);

const positionOf = ({ currentPhase, currentStage, currentStatus }) =>
  key("status", currentPhase, currentStage, currentStatus);

const caseReferences = (kase, taskGroups) => {
  const { currentPhase, currentStage } = kase;

  return [
    positionOf(kase),
    ...taskGroups.map((taskGroup) =>
      key("taskGroup", currentPhase, currentStage, taskGroup),
    ),
    ...(kase.timeline ?? []).flatMap(timelineReferences),
  ];
};

// The case page checks every task group of the version's current stage on the
// case, and every one of the case's against the version.
const isReadable = (kase, { references, taskGroupsOf }) => {
  const taskGroups = currentTaskGroupsOf(kase);
  const versionTaskGroups =
    taskGroupsOf.get(key(kase.currentPhase, kase.currentStage)) ?? [];

  return (
    caseReferences(kase, taskGroups).every((reference) =>
      references.has(reference),
    ) && versionTaskGroups.every((taskGroup) => taskGroups.includes(taskGroup))
  );
};

const caseRefsInUnreadableSeries = async (
  db,
  workflowCode,
  caseRefs,
  references,
) => {
  const series = await db
    .collection("case_series")
    .find(
      { workflowCode, caseRefs: { $in: caseRefs } },
      { projection: { _id: 0, caseRefs: 1 } },
    )
    .toArray();
  const members = [...new Set(series.flatMap((one) => one.caseRefs))];
  const unreadable = new Set();

  for await (const member of db.collection("cases").find(
    { workflowCode, caseRef: { $in: members } },
    {
      projection: {
        _id: 0,
        caseRef: 1,
        currentPhase: 1,
        currentStage: 1,
        currentStatus: 1,
      },
    },
  )) {
    if (!references.has(positionOf(member))) {
      unreadable.add(member.caseRef);
    }
  }

  return new Set(
    series
      .filter((one) => one.caseRefs.some((ref) => unreadable.has(ref)))
      .flatMap((one) => one.caseRefs),
  );
};

const readableCaseIds = async (db, workflowCode, definition) => {
  const readable = [];
  const candidates = db.collection("cases").find(
    { ...versionless, workflowCode },
    {
      projection: {
        caseRef: 1,
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
    if (isReadable(kase, definition)) {
      readable.push({ _id: kase._id, caseRef: kase.caseRef });
    }
  }

  const inUnreadableSeries = await caseRefsInUnreadableSeries(
    db,
    workflowCode,
    readable.map((kase) => kase.caseRef),
    definition.references,
  );

  return readable
    .filter((kase) => !inUnreadableSeries.has(kase.caseRef))
    .map((kase) => kase._id);
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
    const definition = version
      ? await definitionOf(db.collection("workflows"), workflowCode, version)
      : null;
    const ids =
      definition?.references.size > 0
        ? await readableCaseIds(db, workflowCode, definition)
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
