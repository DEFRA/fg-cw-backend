import {
  ConfigVersion,
  FetchStatus,
} from "../../src/cases/models/config-version.js";

export const seedConfigVersion = async (
  db,
  grantCode,
  version = "1.0.0",
  overrides = {},
) => {
  const cv = ConfigVersion.new({
    grantCode,
    version,
    status: "active",
    s3Key: `${grantCode}/${version}/workflow-definition.json`,
    s3Bucket: "config-broker-local",
  });

  const doc = { ...cv.toDocument(), ...overrides };

  await db
    .collection("config_versions")
    .updateOne({ grantCode, version }, { $set: doc }, { upsert: true });

  return cv;
};

export { ConfigVersion, FetchStatus };
