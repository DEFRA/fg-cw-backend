import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { SqsSubscriber } from "../../common/sqs-subscriber.js";
import { addAgreementToCaseUseCase } from "../use-cases/save-case-agreement.use-case.js";

export const createUpdateStatusAgreementConsumer = new SqsSubscriber({
  queueUrl: config.get("aws.sqs.updateStatusUrl"),
  async onMessage(message) {
    const { data } = message;

    const { clientRef, ...rest } = data;

    await addAgreementToCaseUseCase({ caseRef: clientRef, ...rest });

    logger.info(`Updated case status with ref "${data.clientRef}"`);
  },
});
