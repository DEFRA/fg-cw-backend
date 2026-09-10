import Boom from "@hapi/boom";
import Joi from "joi";
import { getMessageGroupId } from "../../common/get-message-group-id.js";
import {
  appendAttempt,
  normaliseAttemptHistory,
  toAttemptEntry,
  toLastError,
} from "./last-error.js";

export const OutboxStatus = {
  PUBLISHED: "PUBLISHED",
  PROCESSING: "PROCESSING",
  FAILED: "FAILED",
  COMPLETED: "COMPLETED",
  RESUBMITTED: "RESUBMITTED",
  DEAD_LETTER: "DEAD_LETTER",
};

export class Outbox {
  static validationSchema = Joi.object({
    target: Joi.string().required(),
    event: Joi.object().required(),
    segregationRef: Joi.string().required(),
  });

  // eslint-disable-next-line complexity
  constructor(props) {
    const { error } = Outbox.validationSchema.validate(props, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid Outbox: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this._id = props._id;
    this.publicationDate = props.publicationDate || new Date();
    this.target = props.target;
    this.event = props.event;
    this.lastResubmissionDate = props.lastResubmissionDate;
    // Rows written before `lastError` existed have none and must stay null.
    this.lastError = props.lastError || null;
    // Rows written before `attemptHistory` existed must read back as [], never
    // null - the detail view renders the array unconditionally.
    this.attemptHistory = normaliseAttemptHistory(props.attemptHistory);
    // ATTEMPT ARITHMETIC - see the canonical note in models/inbox.js.
    this.completionAttempts = props.completionAttempts ?? 0;
    this.status = props.status || OutboxStatus.PUBLISHED;
    this.completionDate = props.completionDate;
    // `{ at, by }` of the most recent redrive; null until redriven.
    this.lastRedrive = props.lastRedrive ?? null;
    this.claimedBy = null;
    this.claimedAt = null;
    this.claimExpiresAt = null;
    this.segregationRef = props.segregationRef;
  }

  markAsComplete() {
    this.status = OutboxStatus.COMPLETED;
    this.completionDate = new Date().toISOString();
    this.claimedBy = null;
    this.claimedAt = null;
    this.claimExpiresAt = null;
  }

  // Absent `error` (a resubmission sweep) leaves the previous `lastError`.
  markAsFailed(error) {
    this.status = OutboxStatus.FAILED;
    this.lastResubmissionDate = new Date().toISOString();
    this.lastError = toLastError(error) ?? this.lastError;
    // `markAsComplete` deliberately leaves the history in place, so a row
    // that eventually succeeded still shows what it took.
    this.attemptHistory = appendAttempt(
      this.attemptHistory,
      toAttemptEntry(error),
    );
    this.completionAttempts += 1;
    this.claimedBy = null;
    this.claimedAt = null;
    this.claimExpiresAt = null;
  }

  toDocument() {
    return {
      _id: this._id,
      publicationDate: this.publicationDate,
      target: this.target,
      event: this.event,
      lastResubmissionDate: this.lastResubmissionDate,
      lastError: this.lastError,
      attemptHistory: this.attemptHistory,
      completionAttempts: this.completionAttempts,
      status: this.status,
      completionDate: this.completionDate,
      lastRedrive: this.lastRedrive,
      claimedAt: this.claimedAt,
      claimedBy: this.claimedBy,
      claimExpiresAt: this.claimExpiresAt,
      segregationRef: this.segregationRef,
    };
  }

  static getSegregationRef(event) {
    const { data } = event;
    return getMessageGroupId(null, data);
  }

  static fromDocument(doc) {
    return new Outbox({
      _id: doc._id,
      publicationDate: doc.publicationDate,
      target: doc.target,
      event: doc.event,
      lastResubmissionDate: doc.lastResubmissionDate,
      lastError: doc.lastError,
      attemptHistory: doc.attemptHistory,
      completionAttempts: doc.completionAttempts,
      status: doc.status,
      completionDate: doc.completionDate,
      lastRedrive: doc.lastRedrive,
      claimedAt: doc.claimedAt,
      claimedBy: doc.claimedBy,
      claimExpiresAt: doc.claimExpiresAt,
      segregationRef: doc.segregationRef,
    });
  }

  static createMock(doc) {
    return new Outbox({
      target: "foo:barr",
      event: {
        messageGroupId: "foo-barr",
      },
      segregationRef: "1234",
      ...doc,
    });
  }
}
