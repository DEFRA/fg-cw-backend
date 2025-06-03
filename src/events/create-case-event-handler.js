import { caseService } from "../service/case.service.js";
import { logger } from "../common/logger.js";

export const createCaseEventHandler = (server) => async (event) => {
  const newCase = await caseService.handleCreateCaseEvent(event.data);

  logger.info(
    `New case created for workflow: ${newCase.workflowCode} with caseRef: ${newCase.caseRef}`
  );
};
