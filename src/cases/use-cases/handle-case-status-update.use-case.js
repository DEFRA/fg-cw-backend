import { logger } from "../../common/logger.js";
import { progressCaseUseCase } from "./progress-case.use-case.js";

export const handleCaseStatusUpdateUseCase = async (message) => {
  const {
    event: { data },
  } = message;

  logger.info(
    `Updating status of case with caseRef ${data.caseRef} and workflowCode ${data.workflowCode}`,
  );

  await progressCaseUseCase(data);

  logger.info(
    `Finished: Updating status of case with caseRef ${data.caseRef} and workflowCode ${data.workflowCode}`,
  );
};
