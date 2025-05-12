import { publish } from "../common/sns.js";
import { config } from "../config.js";

export async function publishEvent(topic, payload) {
  const topicArn = config.aws.caseStageUpdatedTopicArn;

  if (!topicArn) {
    throw new Error(
      "SNS topic ARN is not defined in configuration (caseStageUpdatedTopicArn)"
    );
  }

  console.log(`[publishEvent] Topic: ${topicArn}`);
  console.log(`[publishEvent] Payload:`, JSON.stringify(payload, null, 2));

  return publish(topicArn, payload);
}
