import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { getTraceId } from "@defra/hapi-tracing";
import { randomUUID } from "node:crypto";
import { Outbox } from "../cases/models/outbox.js";
import { insertMany } from "../cases/repositories/outbox.repository.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { getRequestContext } from "./request-context.js";

const getCorrelationId = () => getTraceId() ?? randomUUID();
// System-originated events (e.g. inbox consumers) have no HTTP request context,
// so default to the unspecified-address sentinel to satisfy the required `ip` field.
const SYSTEM_IP = "0.0.0.0";
const getIP = (context) => context?.ip ?? SYSTEM_IP;

const isPlainObject = (value) => value?.constructor === Object;

export const stripNulls = (obj) => {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value == null) {
      continue;
    }

    result[key] = isPlainObject(value) ? stripNulls(value) : value;
  }

  return result;
};

export const buildPayload = ({
  entities,
  accounts,
  status,
  details,
  security,
}) => {
  const context = getRequestContext();

  return {
    datetime: new Date().toISOString(),
    version: config.get("serviceVersion"),
    application: "Case Working Service",
    component: config.get("serviceName"),
    environment: config.get("cdpEnvironment"),
    correlationid: getCorrelationId(),
    ip: getIP(context),
    security,
    audit: {
      entities,
      accounts,
      status,
      details,
    },
  };
};

export const writeAuditEvent = async (
  { entities, accounts, details, security, messageGroupId, status },
  session,
) => {
  logger.info("Begin write audit event.");

  const payload = stripNulls(
    buildPayload({ entities, accounts, status, details, security }),
  );

  const { valid, errors } = validateAuditEvent(payload);

  if (valid === false) {
    logger.warn(errors, "Audit event failed validation - skipping write.");
  } else {
    const msgGroupId = messageGroupId ?? randomUUID();

    const outboxEntry = new Outbox({
      target: config.get("aws.sns.auditTopicArn"),
      event: { ...payload, messageGroupId: msgGroupId },
      segregationRef: msgGroupId,
    });

    await insertMany([outboxEntry], session);
  }

  logger.info("End write audit event.");
};
