import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";

export const validateModel = (props, schema) => {
  const { error, value } = schema.validate(props, {
    stripUnknown: true,
    abortEarly: false,
  });

  if (error) {
    const schemaLabel = schema._flags?.label || "Unknown";
    const message = `Invalid ${schemaLabel}: ${error.details.map((d) => d.message).join(", ")}`;
    logger.warn(error, message);
    throw Boom.badRequest(message);
  }

  return value;
};
