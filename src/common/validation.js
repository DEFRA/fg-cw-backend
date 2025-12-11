import Boom from "@hapi/boom";

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
