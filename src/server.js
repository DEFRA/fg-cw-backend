import Hapi from "@hapi/hapi";
import { config } from "./config.js";
import { router } from "./plugin/router.js";
import { requestLogger } from "./common/helpers/logging/request-logger.js";
import { failAction } from "./common/helpers/fail-action.js";
import { secureContext } from "./common/helpers/secure-context/index.js";
import { pulse } from "./common/helpers/pulse.js";
import { requestTracing } from "./common/helpers/request-tracing.js";
import { setupProxy } from "./common/helpers/proxy/setup-proxy.js";
import HapiSwagger from "hapi-swagger";
import Inert from "@hapi/inert";
import Vision from "@hapi/vision";
import { createCaseEventConsumer } from "./events/subscribers/create-case-event-consumer.js";
import { mongoClient } from "./common/helpers/db.js";

async function createServer(host, port) {
  setupProxy();
  const server = Hapi.server({
    host,
    port,
    routes: {
      validate: {
        options: {
          abortEarly: false
        },
        failAction
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

  server.events.on("start", async () => {
    await mongoClient.connect();
  });

  server.events.on("stop", async () => {
    await mongoClient.close(true);
  });

  // Hapi Plugins:
  // requestLogger  - automatically logs incoming requests
  // requestTracing - trace header logging and propagation
  // secureContext  - loads CA certificates from environment config
  // pulse          - provides shutdown handlers
  // mongoDb        - sets up mongo connection pool and attaches to `server` and `request` objects
  // router         - routes used in the app

  await server.register([
    requestLogger,
    requestTracing,
    secureContext,
    pulse,
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: swaggerOptions
    },
    router,
    createCaseEventConsumer(config.get("aws.createNewCaseSqsUrl"), server)
  ]);

  return server;
}

export { createServer };
