import {
  CLIENT_NAME_MAX,
  isClientName,
} from "../src/clients/models/client-name.js";
import { logger } from "../src/common/logger.js";
import { CASE_READER_CLIENT } from "../src/common/require-case-reader.js";

// FGP-1572: every token row gets a valid client name, so the grants admin can
// manage it. A name that fails the rule is normalised; a row with none, or one
// that normalises to nothing or to a name the rule still refuses, is named
// after its token as GPA shows it.

// Names a check trusts, on this service or fg-gas-backend's. A row normalised
// into one would gain, or could be mistaken for, that access.
const TRUSTED_NAMES = new Set([CASE_READER_CLIENT, "fg-grants-platform-admin"]);

const SHORT_ID_LENGTH = 6;

const normalise = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, CLIENT_NAME_MAX)
    .replace(/-$/, "");

const unnamed = (_id) => `unnamed-${_id.toHexString().slice(-SHORT_ID_LENGTH)}`;

const nameFor = ({ _id, client }) => {
  const normalised = typeof client === "string" ? normalise(client) : "";

  return isClientName(normalised) && !TRUSTED_NAMES.has(normalised)
    ? { client: normalised, kind: "normalised" }
    : { client: unnamed(_id), kind: "named" };
};

export const up = async (db) => {
  const accessTokens = db.collection("access_tokens");
  const rows = await accessTokens
    .find({}, { projection: { _id: 1, client: 1 } })
    .toArray();
  const badNames = rows.filter(({ client }) => !isClientName(client));
  const counts = { normalised: 0, named: 0 };

  for (const row of badNames) {
    const { client, kind } = nameFor(row);

    const { modifiedCount } = await accessTokens.updateOne(
      { _id: row._id, client: row.client },
      { $set: { client } },
    );

    counts[kind] += modifiedCount;
  }

  logger.info(
    `Normalised ${counts.normalised} access token client names, named ${counts.named} nameless tokens`,
  );
};
