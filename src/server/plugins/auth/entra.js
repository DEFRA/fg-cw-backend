import { config as defaultConfig } from "../../../common/config.js";
import { findAll as userFindAll } from "../../../users/repositories/user.repository.js";

export const ENTRA_STRATEGY = "entra";

export const entraStrategyOptions = ({
  config = defaultConfig,
  findAll = userFindAll,
} = {}) => ({
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
    const roles = entra.roles.filter((role) => payload.roles.includes(role));

    const raw = {
      idpId: payload.oid,
      name: payload.name,
      idpRoles: Array.from(roles),
    };

    const [user = null] = await findAll({
      idpId: raw.idpId,
    });

    return {
      isValid: roles.length > 0,
      credentials: {
        raw,
        user,
      },
    };
  },
});
