import Boom from "@hapi/boom";
import {
  findStatusById,
  redriveById,
} from "../../cases/repositories/inbox.repository.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSystemSecurityContext } from "../../common/audit-security-context.js";
import { config } from "../../common/config.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { redriveConflict } from "../../events/event-redrive.js";
import { logger } from "../../common/logger.js";

const DECIMAL = 10;

const MAX_ATTEMPTS = Number.parseInt(
  config.get("inbox.inboxMaxRetries"),
  DECIMAL,
);

// Nothing matched the update: either the row is gone (404) or it is no longer
// DEAD_LETTER (409). One extra read tells them apart, on the failure path
// alone.
const refusal = async (id, session) => {
  const status = await findStatusById(id, session);

  if (status === null) {
    return Boom.notFound(`Inbox event "${id}" not found`);
  }

  logger.warn(`Refused a redrive of inbox event "${id}" - it is ${status}`);

  return redriveConflict("Inbox", id, status);
};

// The update is the precondition: it matches only a DEAD_LETTER row, so a
// concurrent status change loses cleanly.
const redriveInboxEvent = async ({ id, by }, session) => {
  // The row records the absence of an operator as a null; this is only what
  // that absence is called in a log line.
  //
  // Interpolated into the message rather than passed as context props, like
  // the rest of this repo: the log pipeline drops props it does not know, so
  // the message is the only part that survives ingestion - and this pair is
  // the service's own record of who redrove what.
  const actor = by ?? "System";

  logger.info(`Redriving inbox event "${id}" for ${actor}`);

  const row = await redriveById(id, { by, session });

  if (row) {
    // `lastRedrive` on the row is a `$set`, so a later redrive replaces it;
    // the audit event written alongside it is the record that survives.
    logger.info(`Finished: Redriving inbox event "${id}" for ${actor}`);

    return { ...row, maxAttempts: MAX_ATTEMPTS };
  }

  throw await refusal(id, session);
};

// This service audits its own state change. GAS records the operator's
// REQUEST on its own side; this records what Caseworking actually did, so the
// row and the record of it cannot come apart. Deliberately double-recorded:
// the two answer different questions.
//
// `by` is the operator GAS forwarded, and a null stays a null - "System" is
// GAS's display wording, not this service's storage. `caller` is the
// authenticated service client that asked, which is GAS itself.
export const redriveInboxEventAuditBuilder = ([{ id, by, caller }]) => ({
  entities: [
    {
      entity: auditEntities.EVENT,
      action: auditActions.REDRIVE_EVENT,
      entityid: id,
    },
  ],
  details: {
    security: buildSystemSecurityContext(),
    event: { box: "inbox", actor: by ?? null, caller: caller ?? null },
  },
  security: buildAuditSecurity(auditActions.REDRIVE_EVENT),
  segregationRef: `redrive-event-${id}`,
});

/**
 * The row update and the audit event commit together or not at all.
 *
 * The audit is not a publish: `writeAuditEvent` inserts it into this service's
 * own outbox collection, in the same database as the row being redriven, so
 * one transaction covers both. If the audit cannot be written - a failed
 * insert, or a payload that will not validate - `withAudit` rethrows and the
 * transaction aborts: the row stays DEAD_LETTER and GAS is told the redrive
 * failed, rather than a redrive nobody can prove happened.
 */
export const redriveInboxEventUseCase = (command) =>
  withTransaction((session) =>
    withAudit(redriveInboxEvent, redriveInboxEventAuditBuilder)(
      command,
      session,
    ),
  );
