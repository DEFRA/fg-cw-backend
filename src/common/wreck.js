import { getTraceId } from "@defra/hapi-tracing";
import Wreck from "@hapi/wreck";
import { config } from "./config.js";

export const wreck = Wreck.defaults({
  events: true,
  timeout: 3000,
});

wreck.events.on("preRequest", (_uri, options) => {
  const traceId = getTraceId();

  if (traceId) {
    options.headers ??= {};
    options.headers[config.get("tracing.header")] = traceId;
  }
});
