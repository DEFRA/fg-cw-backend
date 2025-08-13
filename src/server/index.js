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

  return server;
};
