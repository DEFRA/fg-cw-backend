import { caseUseCase } from "../../use-case/case/case.use-case.js";

const createCaseEventHandler = (server) => async (message) => {
  server.logger.info({
    message: "Received SQS message",
    body: message.Body
  });

  // Process the message
  const createNewCaseEvent = JSON.parse(message.Body);
  createNewCaseEvent.createdAt = new Date(createNewCaseEvent.createdAt);
  createNewCaseEvent.submittedAt = new Date(createNewCaseEvent.submittedAt);
  const newCase = await caseUseCase.handleCreateCaseEvent(createNewCaseEvent);

  server.logger.info({
    message: `New case created for workflow: ${newCase.workflowCode} with caseRef: ${newCase.caseRef}`,
    body: message.Body
  });
};

export { createCaseEventHandler };
