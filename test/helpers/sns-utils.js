import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { PurgeQueueCommand, SQSClient } from "@aws-sdk/client-sqs";
import { config } from "../../src/common/config.js";

export const sendSnsMessage = async (topicArn, message) => {
  const snsClient = new SNSClient({
    endpoint: config.get("aws.snsEndpoint") || "http://localhost:4566",
    region: config.get("aws.awsRegion") || "eu-west-2",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
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
    endpoint: config.get("aws.sqsEndpoint") || "http://localhost:4566",
    region: config.get("aws.awsRegion") || "eu-west-2",
    credentials: {
      accessKeyId: "test",
      secretAccessKey: "test",
    },
  });

  await sqsClient.send(
    new PurgeQueueCommand({
      QueueUrl: queueUrl,
    }),
  );
};
