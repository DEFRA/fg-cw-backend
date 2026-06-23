export const up = async (db) => {
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
};
