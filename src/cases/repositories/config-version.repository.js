import { actuatorReadMaxTimeMs } from "../../common/actuator-read.js";
import { FetchStatus } from "../../common/fetch-status.js";
import { db } from "../../common/mongo-client.js";
import { recordConfigChange } from "../../common/search/current-searches.js";
import { withTransaction } from "../../common/with-transaction.js";
import { ConfigVersion } from "../models/config-version.js";

const collection = "config_versions";

// A version arriving or changing is counted with it, which orders a
// workflow's search declarations.
export const upsert = async (configVersion) => {
  const doc = configVersion.toDocument();

  return withTransaction(async (session) => {
    const result = await db.collection(collection).updateOne(
      { grantCode: doc.grantCode, version: doc.version },
      {
        $set: {
          major: doc.major,
          minor: doc.minor,
          patch: doc.patch,
          status: doc.status,
          s3Key: doc.s3Key,
          s3Bucket: doc.s3Bucket,
          fetchStatus: doc.fetchStatus,
          fetchError: doc.fetchError,
          fetchAttempts: doc.fetchAttempts,
          lastFetchAttemptAt: doc.lastFetchAttemptAt,
        },
        $setOnInsert: {
          receivedAt: doc.receivedAt,
          fetchedAt: doc.fetchedAt,
        },
      },
      { upsert: true, session },
    );

    if (result.upsertedCount + result.modifiedCount > 0) {
      await recordConfigChange(db, doc.grantCode, session);
    }

    return result;
  });
};

// Resolves the highest active version within the same major (any minor/patch).
// Lazy filter: only excludes PermanentError so an uncached newer version is
// still selectable and triggers an on-demand S3 fetch.
export const findLatestForMajor = async (grantCode, major) => {
  const doc = await db.collection(collection).findOne(
    {
      grantCode,
      major,
      status: "active",
      fetchStatus: { $ne: FetchStatus.PermanentError },
    },
    { sort: { minor: -1, patch: -1 } },
  );

  return ConfigVersion.fromDocument(doc);
};

export const updateFetchStatus = async (
  grantCode,
  version,
  fetchStatus,
  fetchError = null,
) => {
  const update = {
    fetchStatus,
    fetchError,
    lastFetchAttemptAt: new Date().toISOString(),
  };

  if (fetchStatus === FetchStatus.Fetched) {
    update.fetchedAt = new Date().toISOString();
  }

  // Only failed attempts count towards the retry limit; a successful fetch
  // must not push fetchAttempts over MAX_FETCH_ATTEMPTS.
  const mongoUpdate = { $set: update };
  if (fetchStatus !== FetchStatus.Fetched) {
    mongoUpdate.$inc = { fetchAttempts: 1 };
  }

  return db
    .collection(collection)
    .updateOne({ grantCode, version }, mongoUpdate);
};

export const findByGrantCodeAndVersion = async (grantCode, version) => {
  const doc = await db.collection(collection).findOne({ grantCode, version });

  return ConfigVersion.fromDocument(doc);
};

const NEWEST_FIRST = { major: -1, minor: -1, patch: -1 };

export const findAllForCode = async (grantCode) => {
  const docs = await db
    .collection(collection)
    .find(
      { grantCode },
      { sort: NEWEST_FIRST, maxTimeMS: actuatorReadMaxTimeMs() },
    )
    .toArray();

  return docs.map(ConfigVersion.fromDocument);
};

// The version a code's bare page opens: the newest active one. Unlike
// findLatestForMajor, a permanent fetch error does not skip it.
export const findCurrent = async (grantCode) => {
  const doc = await db
    .collection(collection)
    .findOne(
      { grantCode, status: "active" },
      { sort: NEWEST_FIRST, maxTimeMS: actuatorReadMaxTimeMs() },
    );

  return ConfigVersion.fromDocument(doc);
};

export const configVersionExists = async ({ grantCode, version }) =>
  (await db
    .collection(collection)
    .findOne(
      { grantCode, version },
      { projection: { _id: 1 }, maxTimeMS: actuatorReadMaxTimeMs() },
    )) !== null;
