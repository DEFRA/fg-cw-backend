import Wreck from "@hapi/wreck";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

const wreckInstance = Wreck.defaults({
  events: true,
  timeout: 3000,
  baseUrl: env.API_URL,
  json: true,
});

const getToken = async () => {
  const tokenResponse = await Wreck.post(env.OIDC_SIGN_TOKEN_ENDPOINT, {
    json: true,
    payload: {
      clientId: "client1",
      username: "admin@t.gov.uk",
    },
  });

  return tokenResponse.payload.access_token;
};

export const wreck = new Proxy(wreckInstance, {
  get(target, prop) {
    if (typeof target[prop] === "function") {
      // eslint-disable-next-line complexity
      return async (...args) => {
        if (["get", "post", "put", "delete", "patch"].includes(prop)) {
          const options = {
            headers: {},
            ...args[1],
          };

          const { headers } = options;

          headers.authorization ??=
            headers.Authorization || `Bearer ${await getToken()}`;

          headers["x-cdp-request-id"] ??= randomUUID().replaceAll("-", "");

          args[1] = options;
        }

        return target[prop].apply(target, args);
      };
    }

    return target[prop];
  },
});
