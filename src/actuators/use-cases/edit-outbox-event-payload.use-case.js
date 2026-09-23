import Boom from "@hapi/boom";
import {
  editPayloadById,
  findEditableById,
} from "../../cases/repositories/outbox.repository.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSystemSecurityContext } from "../../common/audit-security-context.js";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import {
  auditedEdit,
  checkEdit,
  editConflict,
  isStaleEdit,
  staleEdit,
} from "../../events/event-edit.js";
import { REDRIVABLE_STATUSES } from "../../events/event-redrive.js";

const notFound = (id) => Boom.notFound(`Outbox event "${id}" not found`);

// Checked before the payload is, so an editor that went stale, or a row in
// another status, is told so even when its payload would be refused too.
const refusalOf = (id, row, revision) => {
  if (row === null) {
    return notFound(id);
  }

  if (!REDRIVABLE_STATUSES.includes(row.status)) {
    logger.warn(
      `Refused an edit of outbox event "${id}" - it is ${row.status}`,
    );

    return editConflict("Outbox", id, row.status);
  }

  if (isStaleEdit(row, revision)) {
    logger.warn(`Refused a stale edit of outbox event "${id}"`);

    return staleEdit("Outbox", id);
  }

  return null;
};

// The fence still decides a write that landed after the read.
const raceRefusal = async (id, revision, session) =>
  refusalOf(id, await findEditableById(id, session), revision) ??
  staleEdit("Outbox", id);

const editOutboxEventPayload = async (
  { id, by, payload, note, revision },
  session,
) => {
  logger.info(
    `Editing the payload of outbox event "${id}" from revision ${revision} for ${by}`,
  );

  const stored = await findEditableById(id, session);
  const refusal = refusalOf(id, stored, revision);

  if (refusal) {
    throw refusal;
  }

  const changes = checkEdit(stored.event, payload);

  if (
    await editPayloadById(id, {
      event: payload,
      by,
      note,
      revision,
      original: stored.lastEdit ? undefined : stored.event,
      session,
    })
  ) {
    logger.info(
      `Finished: Editing the payload of outbox event "${id}", now at revision ${revision + 1}`,
    );

    return { payloadRevision: revision + 1, ...changes };
  }

  throw await raceRefusal(id, revision, session);
};

// GAS audits the operator's request; this audits what this service changed.
// Where the payload changed and its hashes either side travel; the values and
// the note do not.
export const editOutboxEventPayloadAuditBuilder = (
  [{ id, by, caller, revision }],
  result,
  error,
) => ({
  entities: [
    {
      entity: auditEntities.EVENT,
      action: auditActions.EDIT_EVENT_PAYLOAD,
      entityid: id,
    },
  ],
  details: {
    security: buildSystemSecurityContext(),
    event: {
      box: "outbox",
      actor: by ?? null,
      caller: caller ?? null,
      revision,
      ...auditedEdit(result, error),
    },
  },
  security: buildAuditSecurity(auditActions.EDIT_EVENT_PAYLOAD),
  segregationRef: `edit-event-${id}`,
});

// The row update and its audit event commit together, so a failed audit
// leaves the payload as it was.
export const editOutboxEventPayloadUseCase = (command) =>
  withTransaction((session) =>
    withAudit(editOutboxEventPayload, editOutboxEventPayloadAuditBuilder)(
      command,
      session,
    ),
  );
