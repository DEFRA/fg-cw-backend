import Jwt from "@hapi/jwt";
import { config } from "../../common/config.js";
import { findAll } from "../../users/repositories/user.repository.js";

export const auth = {
  name: "auth",
  async register(server) {
    const entra = config.get("entra");

    await server.register(Jwt);

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

        const roles = new Set(entra.roles).intersection(new Set(payload.roles));

        const raw = {
          idpId: payload.oid,
          name: payload.name,
          idpRoles: Array.from(roles),
        };

        const [user = null] = await findAll({ idpId: raw.idpId });

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
