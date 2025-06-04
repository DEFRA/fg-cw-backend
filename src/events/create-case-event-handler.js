import { logger } from "../common/logger.js";
import { caseService } from "../services/case.service.js";

export const createCaseEventHandler = () => async (event) => {
  const newCase = await caseService.handleCreateCaseEvent(event.data);

  logger.info(
    `New case created for workflow: ${newCase.workflowCode} with caseRef: ${newCase.caseRef}`
  );
};
