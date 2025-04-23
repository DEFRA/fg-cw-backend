import { caseService } from "../service/case.service.js";

const createCaseEventHandler = (server) => async (message) => {
  server.logger.info({
    message: "Received SQS message",
    body: message.Body
  });

  // Process the message
  const messageBody = JSON.parse(message.Body);
  const createNewCaseEvent = JSON.parse(messageBody.Message);
  createNewCaseEvent.createdAt = new Date(createNewCaseEvent.createdAt);
  createNewCaseEvent.submittedAt = new Date(createNewCaseEvent.submittedAt);
  const newCase = await caseService.handleCreateCaseEvent(
    createNewCaseEvent,
    server.db
  );

  server.logger.info({
    message: `New case created for workflow: ${newCase.workflowCode} with caseRef: ${newCase.caseRef}`,
    body: message.Body
  });
};

export { createCaseEventHandler };
