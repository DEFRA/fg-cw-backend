import { config } from "../../../common/config.js";
import { logger } from "../../../common/logger.js";
import { findByClient, upsertForClient } from "./access-token.repository.js";

const PAIR_PATTERN = /^([a-z0-9-]+):([0-9a-f]{64})$/;

const MONGO_DUPLICATE_KEY = 11000;

export const parseTokenHash = (value) => {
  const trimmed = (value ?? "").trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  const match = PAIR_PATTERN.exec(trimmed);

  if (!match) {
    return null;
  }

  const [, client, id] = match;

  return { client, id };
};

const readConfiguredEntry = () => {
  const value = config.get("serviceAccessTokenHash");
  const entry = parseTokenHash(value);

  if (!entry && value?.trim()) {
    logger.warn(
      "SERVICE_ACCESS_TOKEN_HASH is not a client:sha256hex pair - nothing seeded",
    );
  }

  return entry;
};

export const seedAccessToken = async () => {
  const entry = readConfiguredEntry();

  if (!entry) {
    return;
  }

  const { client } = entry;

  try {
    const { modifiedCount } = await upsertForClient(entry);
    const replaced = modifiedCount > 0 ? ", replacing the previous one" : "";

    logger.info(`Seeded access token for ${client}${replaced}`);
  } catch (error) {
    await logSeedFailure(error, entry);
  }
};

const logSeedFailure = async (error, entry) => {
  if (error.code === MONGO_DUPLICATE_KEY) {
    await reportDuplicateKey(entry);
    return;
  }

  logger.error(
    { err: error, code: error.code, codeName: error.codeName },
    `Failed to seed access token for ${entry.client}`,
  );
};

// instances can race the first-ever seed for a client; the loser's
// duplicate-key error is benign only when the winner wrote the same token.
// It also fires when the hash already belongs to another client, or when a
// rotation race let a different secret version win - those are failures.
const reportDuplicateKey = async (entry) => {
  const record = await findByClient(entry.client).catch(() => undefined);

  if (record?.id === entry.id) {
    logger.info(
      `Access token for ${entry.client} was already seeded by another instance`,
    );
    return;
  }

  logger.error(
    `Failed to seed access token for ${entry.client} - the credential conflicts with an existing record`,
  );
};
