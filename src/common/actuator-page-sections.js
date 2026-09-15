import Boom from "@hapi/boom";
import { logger } from "./logger.js";

// A failed section is null and its reason logged, never served.

const SERVER_ERROR = 500;

export const PAGE_SECTIONS = ["list", "counts", "breakdown"];

// A malformed cursor is the caller's 400, not a degraded section reading as
// this service's outage.
const isClientError = (error) =>
  Boom.isBoom(error) && error.output.statusCode < SERVER_ERROR;

export const sectionOf = (box, section, settled) => {
  if (settled.status === "fulfilled") {
    return settled.value;
  }

  if (isClientError(settled.reason)) {
    throw settled.reason;
  }

  logger.error(settled.reason, `Actuator page: ${box} ${section} failed`);

  return null;
};
