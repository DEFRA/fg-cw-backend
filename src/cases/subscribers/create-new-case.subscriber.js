import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { createCaseUseCase } from "../use-cases/create-case.use-case.js";

export const createNewCaseSubscriber = new SqsSubscriber({
  queueUrl: config.get("aws.sqs.createNewCaseUrl"),
  async onMessage(message) {
    const { data } = message;

    const kase = await createCaseUseCase(data);

    logger.info(
      `Created case with id "${kase._id}", caseRef "${kase.caseRef}" and workflowCode "${kase.workflowCode}"`,
    );
  },
});
