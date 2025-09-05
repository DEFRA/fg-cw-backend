import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { PurgeQueueCommand, SQSClient } from "@aws-sdk/client-sqs";
import { env } from "node:process";

// Force AWS SDK to use static credentials for LocalStack
const awsConfig = {
  region: env.AWS_REGION || "eu-west-2",
  endpoint: env.AWS_ENDPOINT_URL || "http://localhost:4567",
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || "test",
  },
  forcePathStyle: true,
};

export const sendSnsMessage = async (topicArn, message) => {
  const snsClient = new SNSClient(awsConfig);

  return await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message),
    }),
  );
};

export const purgeSqsQueue = async (queueUrl) => {
  const sqsClient = new SQSClient(awsConfig);

  await sqsClient.send(
    new PurgeQueueCommand({
      QueueUrl: queueUrl,
    }),
  );
};
