import { ObjectId } from "mongodb";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config } from "../../../common/config.js";
import { logger } from "../../../common/logger.js";

const readJsonFile = (filePath) => JSON.parse(readFileSync(filePath, "utf8"));

// Workflow definitions on disk may carry no _id, a string _id, or extended-JSON
// ({ $oid }) from a mongo dump. toWorkflow expects a real ObjectId, so normalise.
const toObjectId = (id) => {
  if (!id) {
    return new ObjectId();
  }
  return new ObjectId(id.$oid ?? id);
};

const overridesEnabled = () =>
  config.get("cdpEnvironment") === "local" &&
  Boolean(config.get("workflowOverrides"));

// Local-dev only: lets a developer point a workflow code at a JSON file via the
// WORKFLOW_OVERRIDES manifest, bypassing MongoDB so definition changes can be
// prototyped without reseeding. The manifest and files are re-read on every call
// so edits are picked up live. Returns a raw workflow document or null.
export const findOverrideDocument = (code) => {
  if (!overridesEnabled()) {
    return null;
  }

  const manifestPath = config.get("workflowOverrides");
  const filePath = readJsonFile(manifestPath)[code];

  if (!filePath) {
    return null;
  }

  const resolved = resolve(dirname(manifestPath), filePath);
  logger.info(`Loading workflow "${code}" from override file ${resolved}`);

  const doc = readJsonFile(resolved);
  doc._id = toObjectId(doc._id);
  return doc;
};

export const applyOverride = (doc) => findOverrideDocument(doc.code) ?? doc;
