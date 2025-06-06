import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { caseService } from "../services/case.service.js";

export const createNewCaseSubscriber = new SqsSubscriber({
  queueUrl: config.get("aws.createNewCaseSqsUrl"),
  async onMessage(message) {
    const { data } = message;

    const newCase = await caseService.handleCreateCaseEvent(data);

    logger.info(
      `Case created with caseRef "${newCase.caseRef}" and workflowCode "${newCase.workflowCode}"`,
    );
  },
});
