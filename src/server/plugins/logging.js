import hapiPino from "hapi-pino";
import { logger } from "../../common/logger.js";

export const logging = {
  plugin: hapiPino,
  options: {
    logRequestStart: true,
    customRequestStartMessage: (request) => {
      return `[request] ${request.method} ${request.path}`;
    },
    ignorePaths: ["/health"],
    instance: logger,
  },
};
