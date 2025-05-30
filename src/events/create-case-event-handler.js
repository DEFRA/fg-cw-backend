import { caseService } from "../service/case.service.js";

export const createCaseEventHandler = (server) => async (event) => {
  const newCase = await caseService.handleCreateCaseEvent(
    event.data,
    server.db
  );

  server.logger.info(
    `New case created for workflow: ${newCase.workflowCode} with caseRef: ${newCase.caseRef}`
  );
};
