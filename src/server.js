import { tracing } from "@defra/hapi-tracing";
import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import Inert from "@hapi/inert";
import Jwt from "@hapi/jwt";
import Vision from "@hapi/vision";
import hapiPino from "hapi-pino";
import hapiPulse from "hapi-pulse";
import HapiSwagger from "hapi-swagger";
import { cases } from "./cases/index.js";
import { config } from "./common/config.js";
import { logger } from "./common/logger.js";
import { mongoClient } from "./common/mongo-client.js";
import { health } from "./health/index.js";
import { users } from "./users/index.js";
import { auth } from "./auth/index.js";

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

  server.events.on("start", async () => {
    await mongoClient.connect();
  });

  server.events.on("stop", async () => {
    await mongoClient.close(true);
  });

  await server.register([
    {
      plugin: hapiPino,
      options: {
        ignorePaths: ["/health"],
        instance: logger,
      },
    },
    {
      plugin: tracing.plugin,
      options: {
        tracingHeader: config.get("tracing.header"),
      },
    },
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
      options: {
        info: {
          title: "Case Working Service",
          version: config.get("serviceVersion"),
        },
      }
    },
  ]);

  await server.register(Jwt);

  server.auth.strategy("jwt", "jwt", {
    keys: {
      uri: 'https://login.microsoftonline.com/770a2450-0227-4c62-90c7-4e38537f1102/discovery/v2.0/keys'
    },
    verify: {
      exp: true,
      aud: "00000003-0000-0000-c000-000000000000",
      iss: 'https://login.microsoftonline.com/770a2450-0227-4c62-90c7-4e38537f1102/v2.0',
      sub: false,
      nbf: true,
      maxAgeSec: 14400, // 4 hours
      timeSkewSec: 15
    },
    validate: (artifacts, request, h) => {
      const { payload } = artifacts.decoded;

      return {
        isValid: true,
        credentials: { user: payload }
      };
    },
  });

  await server.register([health, cases, users, auth]);

  return server;
};
