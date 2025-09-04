import {
  PurgeQueueCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { env } from "process";

const sqs = new SQSClient({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
});

export const sendMessage = async (queueUrl, message) =>
  sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      DelaySeconds: 0,
    }),
  );

export const purgeQueue = async (queueUrl) =>
  sqs.send(
    new PurgeQueueCommand({
      QueueUrl: queueUrl,
    }),
  );
