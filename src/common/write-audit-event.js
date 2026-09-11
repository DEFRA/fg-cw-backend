import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { getTraceId } from "@defra/hapi-tracing";
import { randomUUID } from "node:crypto";
import { Outbox } from "../events/models/outbox.js";
import { insertMany } from "../events/repositories/outbox.repository.js";
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
  { entities, accounts, details, security, segregationRef, status },
  session,
) => {
  logger.info("Begin write audit event.");

  const payload = stripNulls(
    buildPayload({ entities, accounts, status, details, security }),
  );

  const { valid, errors } = validateAuditEvent(payload);

  if (valid === false) {
    logger.warn(errors, "Audit event failed validation - skipping write.");

    // The same hole a failed insert is, one layer up: inside a caller's
    // transaction, skipping the write would let the action commit with no
    // audit event. An invalid payload is a FAILURE to produce the audit the
    // caller asked for - unlike a `dataBuilder` answering null, which is a
    // deliberate "nothing to audit here". So it aborts the transaction.
    //
    // The reason is already in the warning above; it is deliberately not in
    // the error, which travels back to the caller - a validation message can
    // quote the payload it rejected.
    if (session) {
      throw new Error("Audit event failed validation");
    }
  } else {
    // The audit topic is not FIFO, so segregationRef carries no ordering
    // meaning here - it only partitions outbox work. Callers group related
    // events under a shared ref so they claim in batches and the fifo_locks
    // collection stays bounded; the uuid is a last resort for ungrouped ones.
    const outboxEntry = new Outbox({
      target: config.get("aws.sns.auditTopicArn"),
      event: payload,
      segregationRef: segregationRef ?? randomUUID(),
    });

    await insertMany([outboxEntry], session);
  }

  logger.info("End write audit event.");
};
