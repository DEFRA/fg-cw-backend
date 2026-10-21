import hapi from "@hapi/hapi";
import { requestContext } from "../../src/common/request-context.js";
import { setAuditActor } from "../../src/common/set-audit-actor.js";
import { CASE_READER_CLIENT } from "../../src/common/require-case-reader.js";
import { operatorHeaders } from "./operator.js";

// The real route behind a stand-in for the service token scheme: the client
// is whatever `x-test-client` says, so the case reader guard runs for real.
export const serverFor = async (route) => {
  const server = hapi.server();

  await server.register(requestContext);
  server.auth.scheme("test-service-token", () => ({
    authenticate: (request, h) =>
      h.authenticated({
        credentials: { service: request.headers["x-test-client"] },
      }),
  }));
  server.auth.strategy("public-api", "test-service-token");
  server.ext("onPostAuth", setAuditActor);
  server.route(route);

  return server;
};

export const asGas = (headers = {}) => ({
  "x-test-client": CASE_READER_CLIENT,
  ...operatorHeaders,
  ...headers,
});
