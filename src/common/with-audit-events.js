import { logger } from "./logger.js";
import { FAILURE, SUCCESS, writeAuditEvent } from "./write-audit-event.js";

const attemptWriteAuditEvent = async ({
  args,
  result,
  status,
  buildAuditEvent,
}) => {
  logger.info({ status, args }, "attemp to write audit event");

  const { entities, details, messageGroupId, security, session } =
    buildAuditEvent({ args, result, status });

  logger.info(
    { entities, details, messageGroupId, security, session },
    "built event",
  );

  const writePromise = writeAuditEvent(
    { entities, details, messageGroupId, status, security },
    status === SUCCESS ? session : undefined,
  ).catch((err) => logger.error({ err }, "Failed to write audit event"));

  if (status === SUCCESS && session) {
    await writePromise;
  }
};

export const withAuditEvents =
  (fn, buildAuditEvent) =>
  async (...args) => {
    logger.info(args, "Executing withAuditEvent");
    let status = SUCCESS;
    let result;
    try {
      result = await fn(...args);
      logger.info(result, "withAuditEvents results");
      return result;
    } catch (e) {
      logger.error(e, "withAuditEvents failed");
      status = FAILURE;
      throw e;
    } finally {
      await attemptWriteAuditEvent({
        args,
        result,
        status,
        buildAuditEvent,
      });
    }
  };
