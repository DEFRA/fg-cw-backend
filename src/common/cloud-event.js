import { getTraceId } from "@defra/hapi-tracing";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { getTraceParent } from "./trace-parent.js";

export class CloudEvent {
  id = randomUUID();
  source = config.get("serviceName");
  specversion = "1.0";
  datacontenttype = "application/json";
  time = new Date().toISOString();
  traceparent = getTraceId() ?? getTraceParent();
  type;
  data;
  messageGroupId;

  constructor(type, data, messageGroupId) {
    if (!type) {
      throw new Error("CloudEvent requires input 'type'");
    }
    if (!data) {
      throw new Error("CloudEvent requires input 'data'");
    }
    if (!messageGroupId) {
      throw new Error("CloudEvent requires input 'messageGroupId'");
    }
    this.type = `cloud.defra.${config.get("cdpEnvironment")}.${config.get("serviceName")}.${type}`;
    this.data = data;
    this.messageGroupId = messageGroupId;
  }
}
