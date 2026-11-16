import Boom from "@hapi/boom";
import { keyName } from "../models/dedupe-group-key.js";
import { dedupeConfigurationSchema } from "./dedupe-page.schema.js";

export const compileDedupe = (configuration) => {
  const { value, error } = dedupeConfigurationSchema.validate(configuration);
  if (error)
    throw Boom.badRequest(`Invalid dedupe configuration: ${error.message}`);
  const names = value.groupBy.map(keyName);
  if (new Set(names).size !== names.length)
    throw Boom.badRequest("Group key names must be unique");
  return value;
};
