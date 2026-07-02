export const up = async (db) => {
  // --- 1. Create config_versions collection indexes ---
  const configVersions = db.collection("config_versions");
  await configVersions.createIndex(
    { grantCode: 1, version: 1 },
    { unique: true },
  );
  await configVersions.createIndex({
    grantCode: 1,
    major: 1,
    minor: 1,
    patch: -1,
    status: 1,
  });

  // --- 2. Add config version fields to existing cases ---
  await db
    .collection("cases")
    .updateMany(
      { originalConfigVersion: { $exists: false } },
      { $set: { originalConfigVersion: null, currentConfigVersion: null } },
    );

  // --- 3. Workflows compound index (code + version) ---
  // Handled by 20260629100000-add-workflow-version.js which sets version
  // "0.0.0" on all workflows and creates the { code: 1, version: 1 } index.

  // --- 4. Seed config_versions for legacy workflows at 0.0.0 ---
  const workflows = await db
    .collection("workflows")
    .find({ version: "0.0.0" })
    .toArray();

  const ops = workflows.map((wf) => ({
    updateOne: {
      filter: { grantCode: wf.code, version: "0.0.0" },
      update: {
        $setOnInsert: {
          grantCode: wf.code,
          version: "0.0.0",
          major: 0,
          minor: 0,
          patch: 0,
          status: "active",
          s3Key: null,
          s3Bucket: null,
          fetchStatus: "Fetched",
          fetchedAt: new Date().toISOString(),
          fetchAttempts: 0,
          fetchError: null,
          lastFetchAttemptAt: null,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) {
    await configVersions.bulkWrite(ops);
  }
};
