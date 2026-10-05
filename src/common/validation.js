import Boom from "@hapi/boom";
import { logger } from "./logger.js";

/**
 * Validates props against a Joi schema and throws a Boom error if validation fails
 */
export const validateProps = (props, schema, entityName = "Entity") => {
  const { error, value } = schema.validate(props, {
    stripUnknown: true,
    abortEarly: false,
  });

  if (error) {
    throw Boom.badRequest(
      `Invalid ${entityName}: ${error.details.map((d) => d.message).join(", ")}`,
    );
  }

  return value;
};

// Only each failing key's path and rule: a Joi message quotes the value.
const describeDetails = (error) =>
  (error?.details ?? [])
    .map(({ path, type }) => `${path.join(".")}:${type}`)
    .join(", ");

export const safeFailAction = (_request, _h, error) => {
  logger.warn(`Request failed validation: ${describeDetails(error)}`);

  throw Boom.badRequest("Invalid request");
};

export const safeResponseFailAction = (_request, _h, error) => {
  logger.error(`Response failed validation: ${describeDetails(error)}`);

  throw Boom.badImplementation("Invalid response");
};
