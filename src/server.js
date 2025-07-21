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
      },
    },
  ]);

  await server.register([health, cases, users]);

  server.auth.strategy("jwt", "jwt", {
    keys: async (artifacts) => {
      const jwksUrl =
        "https://login.microsoftonline.com/common/discovery/v2.0/keys";
      const { kid } = artifacts.decoded.header;

      try {
        const response = await fetch(jwksUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
        }

        const jwks = await response.json();

        const jwk = jwks.keys.find((key) => key.kid === kid);
        if (!jwk) {
          throw Boom.unauthorized("Invalid token key ID (kid)");
        }

        // Convert JWK to PEM for token verification
        return Jwt.token.jwkToPem(jwk);
      } catch (error) {
        logger.error("Error fetching public key from JWKS:", error.message);
        throw Boom.unauthorized(
          "Failed to retrieve public key for token validation",
        );
      }
    },
    verify: {
      aud: false,
      iss: false,
      sub: false,
    },
    validate: (artifacts, request, h) => {
      const { payload } = artifacts.decoded;
      // Perform additional validation if required, e.g., check roles, permissions, etc.
      return {
        isValid: true,
        credentials: { user: payload }, // Attach payload data to credentials
      };
    },
  });

  server.auth.default("jwt");

  return server;
};
