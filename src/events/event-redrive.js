import Boom from "@hapi/boom";

// Without the counter reset the dead-letter sweep re-kills the row before it is
// claimed; the history is cleared with it so attempts never exceed maxAttempts.
const RESET_ATTEMPTS = 0;

export const REDRIVE_FROM_STATUS = "DEAD_LETTER";

const redriveRecord = (by, at) => ({
  at: (at ?? new Date()).toISOString(),
  by: by ?? null,
});

// lastError and lastResubmissionDate stay: they record why the row died.
export const redriveUpdate = (resubmittedStatus, { by, at } = {}) => ({
  $set: {
    status: resubmittedStatus,
    completionAttempts: RESET_ATTEMPTS,
    attemptHistory: [],
    lastRedrive: redriveRecord(by, at),
    claimedBy: null,
    claimedAt: null,
    claimExpiresAt: null,
  },
});

// The blocking status is in the body so the caller needn't re-read the row.
export const redriveConflict = (box, id, status) => {
  const error = Boom.conflict(
    `${box} event "${id}" is ${status}, not ${REDRIVE_FROM_STATUS}`,
  );

  error.output.payload.status = status;

  return error;
};
