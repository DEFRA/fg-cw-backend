import Boom from "@hapi/boom";

export const validateModel = (props, schema) => {
  const { error, value } = schema.validate(props, {
    stripUnknown: true,
    abortEarly: false,
  });

  if (error) {
    const schemaLabel = schema._flags?.label || "Unknown";
    throw Boom.badRequest(
      `Invalid ${schemaLabel}: ${error.details.map((d) => d.message).join(", ")}`,
    );
  }

  return value;
};
