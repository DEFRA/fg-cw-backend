import { logger } from "../../common/logger.js";
import { updateSupplementaryDataUseCase } from "./update-supplementary-data.use-case.js";

export const handleAgreementStatusUpdateUseCase = async (message) => {
  const {
    event: { data },
  } = message;

  logger.debug(
    `Handle agreement status update use case started ${data.caseRef} and workflowCode ${data.workflowCode}`,
  );

  if (data?.supplementaryData) {
    await updateSupplementaryDataUseCase(data);
    logger.info(
      `Updated case status with caseRef "${data.caseRef}" and workflowCode "${data.workflowCode}"`,
    );
  }
  logger.debug("Finished: Handle agreement status update use case started.");
};
