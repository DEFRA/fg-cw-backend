import Boom from "@hapi/boom";
import { refusalOf } from "./explore/refusal.js";

const BAD_REQUEST = 400;
const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;

// An answer to what was asked, logged as one, never as a failure.
const answerWith = (statusCode, payload) => {
  const error = new Boom.Boom(payload.reason, {
    statusCode,
    data: { logLevel: "info" },
  });

  error.output.payload = { statusCode, ...payload };

  return error;
};

export const queryInvalid = () =>
  answerWith(BAD_REQUEST, { reason: "EXPLORE_QUERY_INVALID" });

// Every value a query asks for is audited only as a digest with this key.
export const queryUnauditable = () =>
  answerWith(SERVICE_UNAVAILABLE, { reason: "EXPLORE_QUERY_UNAUDITABLE" });

const ANSWERS = {
  INVALID: queryInvalid,
  BUSY: () =>
    answerWith(TOO_MANY_REQUESTS, {
      reason: "EXPLORE_QUERY_BUSY",
      refusal: "BUSY",
    }),
  FULL: () =>
    answerWith(TOO_MANY_REQUESTS, {
      reason: "EXPLORE_QUERY_BUSY",
      refusal: "FULL",
    }),
};

// How Caseworking answers an Explore query it refused: only the refusal's
// code, and why, go back, for GAS to word. Any other error is passed on.
export const answerOfRefusal = (error) => {
  const code = refusalOf(error);

  if (!code) {
    throw error;
  }

  throw Object.hasOwn(ANSWERS, code)
    ? ANSWERS[code]()
    : answerWith(BAD_REQUEST, {
        reason: "EXPLORE_QUERY_REFUSED",
        refusal: code,
        ...(error.detail && { detail: error.detail }),
      });
};
