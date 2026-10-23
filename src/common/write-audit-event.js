import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { getTraceId } from "@defra/hapi-tracing";
import { randomUUID } from "node:crypto";
import { isIP, isIPv6 } from "node:net";
import { Outbox } from "../cases/models/outbox.js";
import { insertMany } from "../cases/repositories/outbox.repository.js";
import { auditStamps } from "../events/stamps.js";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { getRequestContext } from "./request-context.js";

const getCorrelationId = () => getTraceId() ?? randomUUID();

// System-originated events (e.g. inbox consumers) have no HTTP request context,
// so default to the unspecified-address sentinel to satisfy the required `ip` field.
const SYSTEM_IP = "0.0.0.0";

// A user-originated event whose addresses all exceed the schema limit. Kept
// distinct from SYSTEM_IP so a user's action is never labelled as system work.
export const UNRECORDED_IP = "255.255.255.255";

// The fcp-audit-publisher schema caps `ip` at 20 characters, which a full
// IPv6 address exceeds. Until the audit team raises the limit, this is where
// that rule - and only here - is applied.
const MAX_IP_LENGTH = 20;

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

const compressIp = (ip) =>
  isIPv6(ip) ? new URL(`http://[${ip}]`).hostname.slice(1, -1) : ip;

// The shortest equivalent form of `address`, or undefined when it is not an
// IP: IPv4-mapped addresses become plain IPv4 and IPv6 is compressed.
export const normaliseIp = (address = "") => {
  // Drop any IPv6 zone id (e.g. `fe80::1%eth0`).
  const ip = address.split("%")[0].replace(IPV4_MAPPED, "$1");

  return isIP(ip) ? compressIp(ip) : undefined;
};

const fitsSchema = (ip) => ip !== undefined && ip.length <= MAX_IP_LENGTH;

// The request context holds raw facts; this turns them into the audit `ip`.
// Prefers the trusted client address, then the connection, then a marker.
export const toAuditIp = (context) => {
  if (!context) {
    return SYSTEM_IP;
  }

  const fit = [context.clientIp, context.remoteAddress]
    .map(normaliseIp)
    .find(fitsSchema);

  if (fit) {
    return fit;
  }

  logger.warn(
    `No request address fits the audit schema's ${MAX_IP_LENGTH}-character ip limit - recording ${UNRECORDED_IP}.`,
  );

  return UNRECORDED_IP;
};

const isPlainObject = (value) => value?.constructor === Object;

const stripNullsFrom = (value) => {
  if (Array.isArray(value)) {
    return value.filter((item) => item != null).map(stripNullsFrom);
  }

  return isPlainObject(value) ? stripNulls(value) : value;
};

// The outbox insert stores `undefined` as `null`, which the audit service
// rejects, so this has to reach into arrays (e.g. `audit.entities`) too:
// the payload validated must be the payload persisted.
export const stripNulls = (obj) => {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value == null) {
      continue;
    }

    result[key] = stripNullsFrom(value);
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
    user: context?.user,
    datetime: new Date().toISOString(),
    version: config.get("serviceVersion"),
    application: "Case Working Service",
    component: config.get("serviceName"),
    environment: config.get("cdpEnvironment"),
    correlationid: getCorrelationId(),
    ip: toAuditIp(context),
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
      ...auditStamps(payload),
    });

    await insertMany([outboxEntry], session);
  }

  logger.info("End write audit event.");
};
