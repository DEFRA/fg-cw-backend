import hapi from "@hapi/hapi";
import { config } from "../common/config.js";
import { logger } from "../common/logger.js";
import { requestContext } from "../common/request-context.js";
import { auth } from "./plugins/auth/index.js";
import { health } from "./plugins/health.js";
import { logging } from "./plugins/logging.js";
import { mongo } from "./plugins/mongo.js";
import { shutdown } from "./plugins/shutdown.js";
import { swagger } from "./plugins/swagger.js";
import { tracing } from "./plugins/tracing.js";

const ASKED_LEVELS = new Set(["info"]);

// An answer to a person's own mistake, such as a refused query, names only
// its reason, at the level its use case gives it.
const askedLevelOf = (response) =>
  response.isBoom && ASKED_LEVELS.has(response.data?.logLevel)
    ? response.data.logLevel
    : null;

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
    tracing,
    requestContext,
    auth,
    health,
    logging,
    mongo,
    shutdown,
    swagger,
  ]);

  // SonarCloud magic numbers
  const statusCodes = {
    badRequest: 400,
    internalServerError: 500,
  };

  const logClientError = (response) => {
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
  };

  server.ext("onPreResponse", (request, h) => {
    const response = request.response;
    const level = askedLevelOf(response);

    if (level) {
      logger[level](
        `${response.output.statusCode} ${request.route.path}: ${response.message}`,
      );
    } else {
      logClientError(response);
    }

    return h.continue;
  });

  return server;
};
