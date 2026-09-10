import { toStoredLastError } from "../models/last-error.js";
import { isAuditTarget, typeLabels } from "../audit/event-audit.js";

const orNull = (value) => value ?? null;

const toIsoOrNull = (value) =>
  value instanceof Date ? value.toISOString() : orNull(value);

export class InboxEventRow {
  constructor(props) {
    this._id = props._id;
    this.eventId = props.eventId;
    this.type = props.type;
    this.source = props.source;
    this.status = props.status;
    this.completionAttempts = props.completionAttempts;
    this.createdAt = props.createdAt;
    this.lastFailureAt = props.lastFailureAt;
    this.lastError = props.lastError;
    this.completedAt = props.completedAt;
  }

  static fromInbox(inbox) {
    return new InboxEventRow({
      _id: inbox._id.toHexString(),
      eventId: orNull(inbox.messageId),
      type: typeLabels(orNull(inbox.type), false).type,
      source: orNull(inbox.source),
      status: inbox.status,
      completionAttempts: orNull(inbox.completionAttempts),
      createdAt: toIsoOrNull(inbox.eventTime),
      lastFailureAt: toIsoOrNull(inbox.lastResubmissionDate),
      lastError: toStoredLastError(inbox.lastError),
      completedAt: toIsoOrNull(inbox.completionDate),
    });
  }
}

export class OutboxEventRow {
  constructor(props) {
    this._id = props._id;
    this.eventId = props.eventId;
    this.type = props.type;
    this.target = props.target;
    this.status = props.status;
    this.completionAttempts = props.completionAttempts;
    this.createdAt = props.createdAt;
    this.lastFailureAt = props.lastFailureAt;
    this.lastError = props.lastError;
    this.completedAt = props.completedAt;
  }

  static fromOutbox(outbox) {
    return new OutboxEventRow({
      _id: outbox._id.toHexString(),
      eventId: orNull(outbox.event?.id),
      type: typeLabels(orNull(outbox.event?.type), isAuditTarget(outbox.target))
        .type,
      target: orNull(outbox.target),
      status: outbox.status,
      completionAttempts: orNull(outbox.completionAttempts),
      createdAt: toIsoOrNull(outbox.publicationDate),
      lastFailureAt: toIsoOrNull(outbox.lastResubmissionDate),
      lastError: toStoredLastError(outbox.lastError),
      completedAt: toIsoOrNull(outbox.completionDate),
    });
  }
}
