import Hapi from "@hapi/hapi";
import { config } from "./config.js";
import { router } from "./plugin/router.js";
import hapiPino from "hapi-pino";
import hapiPulse from "hapi-pulse";
import { mongoDb } from "./common/mongodb.js";
import { logger } from "./common/logger.js";
import { secureContext } from "./common/secure-context/index.js";
import { requestTracing } from "./common/request-tracing.js";
import HapiSwagger from "hapi-swagger";
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import { createCaseEventConsumer } from "./plugin/create-case-event-consumer.js";

async function createServer(host, port) {
  const server = Hapi.server({
    host,
    port,
    routes: {
      validate: {
        options: {
          abortEarly: false
        },
        failAction: (_request, _h, error) => {
          logger.warn(error, error?.message);
          throw error;
        }
      },
      security: {
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: false
        },
        xss: "enabled",
        noSniff: true,
        xframe: true
      }
    },
    router: {
      stripTrailingSlash: true
    }
  });

  const swaggerOptions = {
    info: {
      title: "Case Working Application Service API Documentation",
      version: config.get("serviceVersion")
    }
  };

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
        instance: logger
      }
    },
    requestTracing,
    secureContext,
    {
      plugin: hapiPulse,
      options: {
        logger,
        timeout: 10_000
      }
    },
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: swaggerOptions
    },
    mongoDb,
    router,
    createCaseEventConsumer(config.get("aws.createNewCaseSqsUrl"), server)
  ]);

  return server;
}

export { createServer };
