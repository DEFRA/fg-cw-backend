import Boom from "@hapi/boom";

// Hard-coded rather than configured: a config var that is unset in one
// environment would fail open in front of case documents and event writes.
export const CASE_READER_CLIENT = "fg-gas-backend";

// 403, not 401: the caller authenticated, it is just not allowed here.
export const requireCaseReader = (request, h) => {
  if (request.auth.credentials?.service !== CASE_READER_CLIENT) {
    throw Boom.forbidden("The actuators are not open to this client");
  }

  return h.continue;
};
