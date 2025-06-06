import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { PurgeQueueCommand, SQSClient } from "@aws-sdk/client-sqs";
import { env } from "node:process";

export const sendSnsMessage = async (topicArn, message) => {
  const snsClient = new SNSClient({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT_URL,
  });

  return await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
    }),
  );
};

export const purgeSqsQueue = async (queueUrl) => {
  const sqsClient = new SQSClient({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT_URL,
  });

  await sqsClient.send(
    new PurgeQueueCommand({
      QueueUrl: queueUrl,
    }),
  );
};
