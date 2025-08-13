import hapiPino from "hapi-pino";
import { logger } from "../../common/logger.js";

export const logging = {
  plugin: hapiPino,
  options: {
    ignorePaths: ["/health"],
    instance: logger,
  },
};
