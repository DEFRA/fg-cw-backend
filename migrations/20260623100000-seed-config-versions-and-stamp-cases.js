const KNOWN_CODES = ["frps-private-beta", "woodland"];
const CONDITIONAL_CODES = ["pigs-might-fly"];
const VERSION = "0.0.0";

const buildConfigVersionDoc = (code) => ({
  grantCode: code,
  version: VERSION,
  major: 0,
  minor: 0,
  patch: 0,
  status: "active",
  s3Key: `${code}/${VERSION}/workflow-definition.json`,
  s3Bucket: "legacy-placeholder",
  receivedAt: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
  fetchStatus: "fetched",
  fetchError: null,
  fetchAttempts: 0,
  lastFetchAttemptAt: null,
});

export const up = async (db) => {
  const workflows = db.collection("workflows");
  const configVersions = db.collection("config_versions");
  const cases = db.collection("cases");

  const conditionalExisting = await workflows
    .find({ code: { $in: CONDITIONAL_CODES } })
    .project({ code: 1 })
    .toArray();

  const codes = [...KNOWN_CODES, ...conditionalExisting.map((doc) => doc.code)];

  for (const code of codes) {
    await workflows.updateMany(
      { code, version: { $exists: false } },
      { $set: { version: VERSION } },
    );

    await configVersions.updateOne(
      { grantCode: code, version: VERSION },
      { $setOnInsert: buildConfigVersionDoc(code) },
      { upsert: true },
    );

    await cases.updateMany(
      { workflowCode: code, originalConfigVersion: null },
      {
        $set: { originalConfigVersion: VERSION, currentConfigVersion: VERSION },
      },
    );
  }
};
