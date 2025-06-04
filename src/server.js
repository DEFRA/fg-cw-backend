import Hapi from "@hapi/hapi";
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import hapiPino from "hapi-pino";
import hapiPulse from "hapi-pulse";
import HapiSwagger from "hapi-swagger";
import { config } from "./common/config.js";
import { logger } from "./common/logger.js";
import { mongoClient } from "./common/mongo-client.js";
import { requestTracing } from "./common/request-tracing.js";
import { createCaseEventConsumer } from "./plugins/create-case-event-consumer.js";
import { router } from "./plugins/router.js";

export const createServer = async (host, port) => {
  const server = Hapi.server({
    host,
    port,
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

  const swaggerOptions = {
    info: {
      title: "Case Working Application Service API Documentation",
      version: config.get("serviceVersion"),
    },
  };

  server.events.on("start", async () => {
    await mongoClient.connect();
  });

  server.events.on("stop", async () => {
    await mongoClient.close(true);
  });

  // Hapi Plugins:
  // hapi pino      - automatically logs incoming requests
  // requestTracing - trace header logging and propagation
  // secureContext  - loads CA certificates from environment config
  // hapi pulse     - provides shutdown handlers
  // mongoDb        - sets up mongo connection pool and attaches to `server` and `request` objects
  // router         - routes used in the app

  await server.register([
    {
      plugin: hapiPino,
      options: {
        ignorePaths: ["/health"],
        instance: logger,
      },
    },
    requestTracing,
    {
      plugin: hapiPulse,
      options: {
        logger,
        timeout: 10_000,
      },
    },
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: swaggerOptions,
    },
    router,
    createCaseEventConsumer(config.get("aws.createNewCaseSqsUrl"), server),
  ]);

  return server;
};
