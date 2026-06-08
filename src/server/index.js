import hapi from "@hapi/hapi";
import { config } from "../common/config.js";
import { logger } from "../common/logger.js";
import {
  getRequestContext,
  withRequestContext,
} from "../common/request-context.js";
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
    tracing,
    auth,
    health,
    logging,
    mongo,
    shutdown,
    swagger,
  ]);

  server.ext("onRequest", (request, h) => {
    const context = {
      user: null,
      subject: null,
      sessionId: null,
      ip: request.info.remoteAddress,
    };
    for (const cycle of ["_lifecycle", "_postCycle"]) {
      const fn = request[cycle].bind(request);
      request[cycle] = () => withRequestContext(context, fn);
    }
    return h.continue;
  });

  // eslint-disable-next-line complexity
  server.ext("onPreHandler", (request, h) => {
    const context = getRequestContext();
    if (context && request.auth?.credentials) {
      const { user, raw } = request.auth.credentials;
      context.user = user?.idpId ?? null;
      // @julian: check if subject is required for context
      context.subject = raw?.idpId ?? null;
    }
    return h.continue;
  });

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
