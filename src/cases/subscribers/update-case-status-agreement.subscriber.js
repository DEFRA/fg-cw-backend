import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { updateCaseStatusUseCase } from "../use-cases/update-case-status.use-case.js";

export const createUpdateStatusAgreementConsumer = new SqsSubscriber({
  queueUrl: config.get("aws.sqs.updateStatusUrl"),
  async onMessage(message) {
    const { data } = message;

    await updateCaseStatusUseCase(data);

    logger.info(
      `Updated case status with caseRef "${data.caseRef}" and workflowCode "${data.workflowCode}"`,
    );
  },
});
