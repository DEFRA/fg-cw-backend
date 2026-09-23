import Boom from "@hapi/boom";
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

// Checked before the payload is, so an editor that went stale, or a row in
// another status, is told so even when its payload would be refused too.
const refusalFor =
  ({ box, boxName }) =>
  (id, row, revision) => {
    if (row === null) {
      return Boom.notFound(`${boxName} event "${id}" not found`);
    }

    if (!REDRIVABLE_STATUSES.includes(row.status)) {
      logger.warn(
        `Refused an edit of ${box} event "${id}" - it is ${row.status}`,
      );

      return editConflict(boxName, id, row.status);
    }

    if (isStaleEdit(row, revision)) {
      logger.warn(`Refused a stale edit of ${box} event "${id}"`);

      return staleEdit(boxName, id);
    }

    return null;
  };

const editEventPayloadFor = (boxEdit) => {
  const { box, boxName, findEditableById, editPayloadById } = boxEdit;
  const refusalOf = refusalFor(boxEdit);

  // The fence still decides a write that landed after the read.
  const raceRefusal = async (id, revision, session) =>
    refusalOf(id, await findEditableById(id, session), revision) ??
    staleEdit(boxName, id);

  return async ({ id, by, payload, note, revision }, session) => {
    logger.info(
      `Editing the payload of ${box} event "${id}" from revision ${revision} for ${by}`,
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
        `Finished: Editing the payload of ${box} event "${id}", now at revision ${revision + 1}`,
      );

      return { payloadRevision: revision + 1, ...changes };
    }

    throw await raceRefusal(id, revision, session);
  };
};

// GAS audits the operator's request; this audits what this service changed.
// Where the payload changed and its hashes either side travel; the values and
// the note do not.
const editEventPayloadAuditBuilderFor =
  ({ box }) =>
  ([{ id, by, caller, revision }], result, error) => ({
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
        box,
        actor: by ?? null,
        caller: caller ?? null,
        revision,
        ...auditedEdit(result, error),
      },
    },
    security: buildAuditSecurity(auditActions.EDIT_EVENT_PAYLOAD),
    segregationRef: `edit-event-${id}`,
  });

// The payload edit both boxes share, given the box's name and its repository.
// The row update and its audit event commit together, so a failed audit leaves
// the payload as it was.
export const editEventPayloadUseCase = (boxEdit) => {
  const editEventPayload = withAudit(
    editEventPayloadFor(boxEdit),
    editEventPayloadAuditBuilderFor(boxEdit),
  );

  return (command) =>
    withTransaction((session) => editEventPayload(command, session));
};
