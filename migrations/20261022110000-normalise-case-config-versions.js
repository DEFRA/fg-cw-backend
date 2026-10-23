import { FetchStatus } from "../src/common/fetch-status.js";
import { logger } from "../src/common/logger.js";

// Gives every case `originalConfigVersion` and `currentConfigVersion` and drops
// the legacy `configVersion`, so the Cases list and the case page read the same
// version. A case missing one version takes it from the legacy one, or else the
// other. A case with no version at all takes `0.0.0` and its workflow's newest
// version that resolves, as `20260806100000-remove-sentinel-config-versions.js`
// chose one, when that version's stored definition holds the case's phase,
// stage and status. A case pinned to its current version is not checked
// against it again.
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

const positionsOf = async (workflows, code, version) => {
  const workflow = await workflows.findOne(
    { code, version },
    {
      projection: {
        "phases.code": 1,
        "phases.stages.code": 1,
        "phases.stages.statuses.code": 1,
      },
    },
  );

  return (workflow?.phases ?? []).flatMap((phase) =>
    phase.stages.flatMap((stage) =>
      stage.statuses.map((status) => ({
        currentPhase: phase.code,
        currentStage: stage.code,
        currentStatus: status.code,
      })),
    ),
  );
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
    const positions = version
      ? await positionsOf(db.collection("workflows"), workflowCode, version)
      : [];

    if (positions.length > 0) {
      const { modifiedCount } = await cases.updateMany(
        { ...versionless, workflowCode, $or: positions },
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
      `Cases left without a config version, as their workflow has no version that holds their position: ${counts.join(", ")}`,
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
