import hapi from "@hapi/hapi";
import { config } from "../common/config.js";
import { logger } from "../common/logger.js";
import { auth } from "./plugins/auth.js";
import { health } from "./plugins/health.js";
import { logging } from "./plugins/logging.js";
import { mongo } from "./plugins/mongo.js";
import { shutdown } from "./plugins/shutdown.js";
import { swagger } from "./plugins/swagger.js";
import { tracing } from "./plugins/tracing.js";

export const createServer = async () => {
  const server = hapi.server({
    host: config.get("host"),
    port: config.get("port"),
    routes: {
      validate: {
        options: {
          abortEarly: false,
        },
        failAction: (_request, _h, error) => {
          logger.warn(error, error?.message);
          throw error;
        },
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false,
        },
        xss: "enabled",
        noSniff: true,
        xframe: true,
      },
    },
    router: {
      stripTrailingSlash: true,
    },
  });

  await server.register([
    auth,
    health,
    logging,
    mongo,
    shutdown,
    swagger,
    tracing,
  ]);

  // SonarCloud magic numbers
  const statusCodes = {
    badRequest: 400,
    internalServerError: 500,
  };

  server.ext("onPreResponse", (request, h) => {
    const response = request.response;

    if (
      response.isBoom &&
      response.output.statusCode >= statusCodes.badRequest &&
      response.output.statusCode < statusCodes.internalServerError
    ) {
      const error = new Error(response.message);

      // CDP doesn't support error.stack
      delete error.stack;
      error.stack_trace = response.stack;

      logger.error(error);
    }

    return h.continue;
  });

  return server;
};
