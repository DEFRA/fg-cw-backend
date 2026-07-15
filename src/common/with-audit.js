import { auditStatus } from "./audit-constants.js";
import { logger } from "./logger.js";
import { writeAuditEvent } from "./write-audit-event.js";

export const withAudit = (f, dataBuilder) =>
  new Proxy(f, {
    async apply(target, _, args) {
      logger.info("withAudit: Begin attempt audit with proxy.");

      let result;
      let status = auditStatus.SUCCESS;
      let session = args[1];

      try {
        result = await target.apply(_, args);
      } catch (error) {
        status = auditStatus.FAILURE;
        session = null;
        throw error;
      } finally {
        logger.debug(result, "withAudit: Use case result within proxy.");
        try {
          const auditData = dataBuilder(args, result);

          if (!auditData) {
            logger.info(
              "withAudit: dataBuilder returned no audit data - skipping audit event.",
            );
          } else {
            const { entities, accounts, details, security, messageGroupId } =
              auditData;

            await writeAuditEvent(
              {
                entities,
                accounts,
                details,
                security,
                messageGroupId,
                status,
              },
              session,
            );
          }
        } catch (auditError) {
          logger.error(
            auditError,
            `withAudit: Failed to write ${status} audit event.`,
          );
        }
      }

      logger.info("withAudit: End audit with proxy.");
      return result;
    },
  });
