import Jwt from "@hapi/jwt";
import { config as defaultConfig } from "../../common/config.js";
import { findAll as userFindAll } from "../../users/repositories/user.repository.js";

const makeAuthPlugin = ({ jwtPlugin, config, findAll }) => {
  return {
    name: "auth",
    async register(server) {
      await server.register(jwtPlugin);

      server.auth.strategy("entra", "jwt", {
        keys: {
          uri: config.get("oidc.jwks.uri"),
        },
        verify: {
          iss: config.get("oidc.verify.iss"),
          aud: config.get("oidc.verify.aud"),
          sub: false,
          exp: true,
          nbf: true,
          maxAgeSec: 14400,
          timeSkewSec: 15,
        },
        async validate(artifacts) {
          const { payload } = artifacts.decoded;

          const entra = config.get("entra");
          const roles = new Set(entra.roles).intersection(
            new Set(payload.roles),
          );

          const raw = {
            idpId: payload.oid,
            name: payload.name,
            idpRoles: Array.from(roles),
          };

          const [user = null] = await findAll({
            idpId: raw.idpId,
          });

          return {
            isValid: roles.size > 0,
            credentials: {
              raw,
              user,
            },
          };
        },
      });
    },
  };
};

const defaultDeps = {
  jwtPlugin: Jwt,
  config: defaultConfig,
  findAll: userFindAll,
};

export const createAuthPlugin = (overrides = {}) =>
  makeAuthPlugin({ ...defaultDeps, ...overrides });

export const auth = createAuthPlugin();
