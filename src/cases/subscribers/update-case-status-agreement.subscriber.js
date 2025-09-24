import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { updateCaseStatusWithDataUseCase } from "../use-cases/update-case-status-with-data.use-case.js";

export const createUpdateStatusAgreementConsumer = new SqsSubscriber({
  queueUrl: config.get("aws.sqs.updateStatusUrl"),
  async onMessage(message) {
    const { data } = message;

    await updateCaseStatusWithDataUseCase(data);

    logger.info(
      `Updated case status with caseRef "${data.caseRef}" and workflowCode "${data.workflowCode}"`,
    );
  },
});
