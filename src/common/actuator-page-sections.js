import Boom from "@hapi/boom";
import { logger } from "./logger.js";

// The composed pages' failure policy: a section that could not be read
// answers with a null beside a named reason, and never takes the page with
// it. Lives here so every section - list, counts, breakdown, hops - degrades
// and reports the same way.

const SECTION_READ_FAILED = "read failed";
const SERVER_ERROR = 500;

// A fixed, payload-free one-liner. A Boom carries a message somebody wrote;
// anything else - a driver error, say - contributes the generic sentence, so
// nothing the database said reaches a caller.
const describeSectionFailure = (error) =>
  Boom.isBoom(error) ? error.output.payload.message : SECTION_READ_FAILED;

// A caller's own mistake is not a degraded section.
//
// Degradation was designed for a backend that failed: a null section beside a
// named reason lets the page render around a database that could not answer.
// A malformed cursor is not that - it is a 400, and the standalone routes
// answer one - so it stays a 400 here. Left to degrade it read as "Mongo is
// down", and two malformed cursors read as a 502: a caller's bug arriving as
// this service's outage.
const isClientError = (error) =>
  Boom.isBoom(error) && error.output.statusCode < SERVER_ERROR;

export const sectionOf = (box, section, settled, sectionErrors) => {
  if (settled.status === "fulfilled") {
    return settled.value;
  }

  if (isClientError(settled.reason)) {
    throw settled.reason;
  }

  logger.error(settled.reason, `Actuator page: ${box} ${section} failed`);

  sectionErrors.push({
    box,
    section,
    message: describeSectionFailure(settled.reason),
  });

  return null;
};
