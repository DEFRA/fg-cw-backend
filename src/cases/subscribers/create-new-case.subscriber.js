import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { createCaseUseCase } from "../use-cases/create-case.use-case.js";

export const createNewCaseSubscriber = new SqsSubscriber({
  queueUrl: config.get("aws.sqs.createNewCaseUrl"),
  async onMessage(message) {
    const { data } = message;

    await createCaseUseCase(data);

    logger.info(
      `Created case with caseRef "${data.caseRef}" and workflowCode "${data.workflowCode}"`,
    );
  },
});
