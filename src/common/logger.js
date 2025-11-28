import { getTraceId } from "@defra/hapi-tracing";
import { ecsFormat } from "@elastic/ecs-pino-format";
import { pino } from "pino";
import { config } from "./config.js";
import { getTraceParent } from "./trace-parent.js";

const requestedLevel = config.get("log.level");
const envName = config.get("cdpEnvironment");
const level =
  envName === "prod" &&
  (requestedLevel === "debug" || requestedLevel === "trace")
    ? "info"
    : requestedLevel;
const format = {
  ecs: {
    ...ecsFormat({
      serviceVersion: config.get("serviceVersion"),
      serviceName: config.get("serviceName"),
    }),
  },
  "pino-pretty": {
    transport: {
      target: "pino-pretty",
    },
  },
}[config.get("log.format")];

export const logger = pino({
  enabled: config.get("log.isEnabled"),
  ignorePaths: ["/health"],
  redact: {
    paths: config.get("log.redact"),
    remove: true,
  },
  level,
  ...format,
  nesting: true,
  errorKey: "error",
  mixin() {
    const mixinValues = {};

    const id = getTraceId() ?? getTraceParent();

    if (id) {
      mixinValues["trace.id"] = id;
    }

    return mixinValues;
  },
});
