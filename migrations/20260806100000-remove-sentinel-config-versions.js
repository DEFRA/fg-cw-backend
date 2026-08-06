export const up = async (db) => {
  const cases = db.collection("cases");
  const configVersions = db.collection("config_versions");

  const workflowCodes = await cases.distinct("workflowCode", {
    currentConfigVersion: "0.0.0",
  });

  for (const workflowCode of workflowCodes) {
    const [highest] = await configVersions
      .find({
        grantCode: workflowCode,
        status: "active",
        version: { $ne: "0.0.0" },
      })
      .sort({ major: -1, minor: -1, patch: -1 })
      .limit(1)
      .toArray();

    if (!highest) {
      continue;
    }

    await cases.updateMany(
      { workflowCode, currentConfigVersion: "0.0.0" },
      { $set: { currentConfigVersion: highest.version } },
    );
  }
};
