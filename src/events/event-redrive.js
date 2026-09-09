import Boom from "@hapi/boom";

// Putting one DEAD_LETTER row back in front of the poller. Shared by both
// boxes, and mirrored in fg-gas-backend so both services behave the same way.
//
// The counter MUST be reset: the poller's claim filter requires
// `completionAttempts < MAX_RETRIES` and the dead-letter sweep re-kills
// anything at or above it, so a redrive that left the counter alone would be
// re-dead-lettered on the next tick and never claimed. 0 is the fresh-insert
// value (see ATTEMPT ARITHMETIC in models/inbox.js), so a redriven row gets
// exactly the MAX_RETRIES fresh attempts a new one would.
const RESET_ATTEMPTS = 0;

export const REDRIVE_FROM_STATUS = "DEAD_LETTER";

// `lastError`, `attemptHistory` and `lastResubmissionDate` are deliberately
// left in place: they are the record of why the row died. `by` is the operator
// from the `x-actor` header GAS validated and forwarded; `lastRedrive` sits on
// the row as well as in the audit event so the detail view can say who put it
// back without an audit-log search.
const redriveRecord = (by, at) => ({
  at: (at ?? new Date()).toISOString(),
  by: by ?? null,
});

export const redriveUpdate = (resubmittedStatus, { by, at } = {}) => ({
  $set: {
    status: resubmittedStatus,
    completionAttempts: RESET_ATTEMPTS,
    lastRedrive: redriveRecord(by, at),
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
  },
});

// 409, with the status that actually blocked the redrive in the body so the
// caller can render "this row is COMPLETED now" without a second request.
export const redriveConflict = (box, id, status) => {
  const error = Boom.conflict(
    `${box} event "${id}" is ${status}, not ${REDRIVE_FROM_STATUS}`,
  );

  error.output.payload.status = status;

  return error;
};
