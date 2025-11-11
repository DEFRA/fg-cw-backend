import Wreck from "@hapi/wreck";
import { randomUUID } from "node:crypto";
import { env } from "node:process";

const _wreck = Wreck.defaults({
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

// eslint-disable-next-line complexity
const createOptions = async (options = {}) => {
  const _options = structuredClone({
    headers: {},
    ...options,
  });

  const { headers } = _options;

  headers.authorization ??=
    headers.Authorization || `Bearer ${await getToken()}`;

  headers["x-cdp-request-id"] ??= randomUUID().replaceAll("-", "");

  return _options;
};

export const wreck = {
  async get(uri, options) {
    const _options = await createOptions(options);
    return _wreck.get(uri, _options);
  },

  async post(uri, options) {
    const __options = await createOptions(options);
    return _wreck.post(uri, __options);
  },

  async put(uri, options) {
    const opts = await createOptions(options);
    return _wreck.put(uri, opts);
  },

  async patch(uri, options) {
    const opts = await createOptions(options);
    return _wreck.patch(uri, opts);
  },

  async delete(uri, options) {
    const opts = await createOptions(options);
    return _wreck.delete(uri, opts);
  },
};
