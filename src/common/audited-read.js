import { auditStatus } from "./audit-constants.js";
import { logger } from "./logger.js";
import { withTransaction } from "./with-transaction.js";
import { writeAuditEvent } from "./write-audit-event.js";

// Within the caller's HTTP timeout, after the read's own maxTimeMS.
const AUDIT_MAX_COMMIT_TIME_MS = 500;

// The read runs outside any session. Its SUCCESS audit then commits on its own,
// and only after that is the data returned, so a read nobody recorded never
// reaches the caller. A FAILURE is best effort and never hides the error.
export const auditedRead = (read, buildAudit) => async (args) => {
  let result;

  try {
    result = await read(args);
  } catch (error) {
    try {
      await writeAuditEvent({
        ...buildAudit(args, null, error),
        status: auditStatus.FAILURE,
      });
    } catch {
      logger.error("Read FAILURE audit event not written");
    }

    throw error;
  }

  await withTransaction(
    (session) =>
      writeAuditEvent(
        { ...buildAudit(args, result), status: auditStatus.SUCCESS },
        session,
      ),
    { maxCommitTimeMS: AUDIT_MAX_COMMIT_TIME_MS },
  );

  return result;
};
