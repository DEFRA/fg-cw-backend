export const up = async (db) => {
  const cases = db.collection("cases");
  const configVersions = db.collection("config_versions");

  const workflowCodes = await cases.distinct("workflowCode", {
    originalConfigVersion: null,
  });

  for (const workflowCode of workflowCodes) {
    const [highest] = await configVersions
      .find({ grantCode: workflowCode, status: "active" })
      .sort({ major: -1, minor: -1, patch: -1 })
      .limit(1)
      .toArray();

    const currentVersion = highest?.version ?? "0.0.0";

    await cases.updateMany(
      { workflowCode, originalConfigVersion: null },
      {
        $set: {
          originalConfigVersion: "0.0.0",
          currentConfigVersion: currentVersion,
        },
      },
    );
  }
};
