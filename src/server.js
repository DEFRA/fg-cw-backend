import Hapi from "@hapi/hapi";
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import hapiPino from "hapi-pino";
import hapiPulse from "hapi-pulse";
import HapiSwagger from "hapi-swagger";
import { cases } from "./cases/index.js";
import { config } from "./common/config.js";
import { logger } from "./common/logger.js";
import { mongoClient } from "./common/mongo-client.js";
import { requestTracing } from "./common/request-tracing.js";
import { health } from "./health/index.js";
import { createCaseEventConsumer } from "./plugins/create-case-event-consumer.js";

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
  // hapi pulse     - provides shutdown handlers

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
    createCaseEventConsumer(config.get("aws.createNewCaseSqsUrl"), server),
  ]);

  await server.register([health, cases]);

  return server;
};
