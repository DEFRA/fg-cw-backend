import { getTraceId } from "@defra/hapi-tracing";
import { ecsFormat } from "@elastic/ecs-pino-format";
import { pino } from "pino";
import { config } from "../config.js";
import { getTraceParent } from "./trace-parent.js";

const level = config.get("log.level");

console.log({ level });

const format = {
  ecs: {
    ...ecsFormat({
      serviceVersion: config.get("serviceVersion"),
      serviceName: config.get("serviceName")
    })
  },
  "pino-pretty": {
    transport: {
      target: "pino-pretty"
    }
  }
}[config.get("log.format")];

export const logger = pino({
  enabled: config.logEnabled,
  ignorePaths: ["/health"],
  redact: {
    paths:
      config.env === "production"
        ? ["req.headers.authorization", "req.headers.cookie", "res.headers"]
        : ["req", "res", "responseTime"],
    remove: true
  },
  level,
  ...format,
  nesting: true,
  mixin() {
    const mixinValues = {};

    const id = getTraceId() ?? getTraceParent();

    if (id) {
      mixinValues.trace = {
        id
      };
    }

    return mixinValues;
  }
});
