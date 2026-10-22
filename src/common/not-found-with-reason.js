import Boom from "@hapi/boom";

// The reason tells the caller a missing record from a missing route.
export const notFoundWithReason = (message, reason) => {
  const error = Boom.notFound(message);

  error.output.payload.reason = reason;

  return error;
};
