import Boom from "@hapi/boom";
import {
  findStatusById,
  redriveById,
} from "../../cases/repositories/outbox.repository.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSystemSecurityContext } from "../../common/audit-security-context.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { redriveConflict } from "../../events/event-redrive.js";
import { logger } from "../../common/logger.js";

// Nothing matched the update: one read tells a missing row (404) from one in
// another status (409).
const refusal = async (id, session) => {
  const status = await findStatusById(id, session);

  if (status === null) {
    return Boom.notFound(`Outbox event "${id}" not found`);
  }

  logger.warn(`Refused a redrive of outbox event "${id}" - it is ${status}`);

  return redriveConflict("Outbox", id, status);
};

const redriveOutboxEvent = async ({ id, by }, session) => {
  // Only the log line names a missing operator; the row and audit keep null.
  const actor = by ?? "System";

  logger.info(`Redriving outbox event "${id}" for ${actor}`);

  if (await redriveById(id, { by, session })) {
    logger.info(`Finished: Redriving outbox event "${id}" for ${actor}`);

    return;
  }

  throw await refusal(id, session);
};

// GAS audits the operator's request; this audits what this service changed.
export const redriveOutboxEventAuditBuilder = ([{ id, by, caller }]) => ({
  entities: [
    {
      entity: auditEntities.EVENT,
      action: auditActions.REDRIVE_EVENT,
      entityid: id,
    },
  ],
  details: {
    security: buildSystemSecurityContext(),
    event: { box: "outbox", actor: by ?? null, caller: caller ?? null },
  },
  security: buildAuditSecurity(auditActions.REDRIVE_EVENT),
  segregationRef: `redrive-event-${id}`,
});

// The row update and its audit event commit together, so a failed audit
// leaves the row DEAD_LETTER.
export const redriveOutboxEventUseCase = (command) =>
  withTransaction((session) =>
    withAudit(redriveOutboxEvent, redriveOutboxEventAuditBuilder)(
      command,
      session,
    ),
  );
