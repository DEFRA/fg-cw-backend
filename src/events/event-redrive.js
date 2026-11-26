import Boom from "@hapi/boom";
import { NO_ERROR_KEY } from "../common/buckets/error-key.js";
import { appendAction, redrivenEntry } from "./event-history.js";

// Without the counter reset the dead-letter sweep re-kills the row before it is
// claimed. The counter is the retry budget; the attempts it spent stay in
// `attemptHistory`, and the ones since the redrive are those after
// `lastRedrive.at`.
const RESET_ATTEMPTS = 0;

export const DEAD_LETTER = "DEAD_LETTER";

// Wider than DEAD_LETTER on purpose: an operator can change their mind about a
// purged row right up until it is deleted.
export const REDRIVABLE_STATUSES = [DEAD_LETTER, "PURGED"];

const redriveRecord = (by, at) => ({
  at: (at ?? new Date()).toISOString(),
  by: by ?? null,
});

// lastError, lastResubmissionDate and lastPurge stay: they record why the row
// died, and what the admin shows as "Previously purged". So does the error key
// of a recorded error; the key of a death with none goes with the death.
export const redriveUpdate = (resubmittedStatus, { by, at } = {}) => {
  const record = redriveRecord(by, at);

  return [
    {
      $set: {
        status: resubmittedStatus,
        retryable: true,
        completionAttempts: RESET_ATTEMPTS,
        lastRedrive: { $literal: record },
        history: appendAction(redrivenEntry(record)),
        expireAt: null,
        claimedBy: null,
        claimedAt: null,
        claimExpiresAt: null,
        errorKey: {
          $cond: [{ $eq: ["$errorKey", NO_ERROR_KEY] }, null, "$errorKey"],
        },
        // An editor opened before the redrive must not save onto what came of it.
        payloadRevision: { $add: [{ $ifNull: ["$payloadRevision", 0] }, 1] },
      },
    },
  ];
};

// The blocking status is in the body so the caller needn't re-read the row.
// The message names the whole set: "not DEAD_LETTER" would lie about a PURGED
// row, which redrives perfectly well.
export const redriveConflict = (box, id, status) => {
  const error = Boom.conflict(
    `${box} event "${id}" is ${status}, not redrivable (${REDRIVABLE_STATUSES.join(" or ")})`,
  );

  error.output.payload.status = status;

  return error;
};
