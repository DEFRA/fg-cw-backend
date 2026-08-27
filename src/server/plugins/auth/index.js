import Jwt from "@hapi/jwt";
import { ENTRA_STRATEGY, entraStrategyOptions } from "./entra.js";
import {
  PUBLIC_API_STRATEGY,
  SERVICE_TOKEN_SCHEME,
  serviceTokenScheme,
} from "./public-api.js";

export const auth = {
  name: "auth",
  async register(server) {
    server.auth.scheme(SERVICE_TOKEN_SCHEME, serviceTokenScheme);
    server.auth.strategy(PUBLIC_API_STRATEGY, SERVICE_TOKEN_SCHEME);

    await server.register(Jwt);
    server.auth.strategy(ENTRA_STRATEGY, "jwt", entraStrategyOptions());
    server.auth.default(ENTRA_STRATEGY);
  },
};
