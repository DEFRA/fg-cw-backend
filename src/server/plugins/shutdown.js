import hapiPulse from "hapi-pulse";
import { logger } from "../../common/logger.js";

export const shutdown = {
  plugin: hapiPulse,
  options: {
    logger,
    timeout: 10_000,
  },
};
