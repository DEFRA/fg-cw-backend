import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import {
  CreateQueueCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "node:process";

// The bucket and topic the compose floci creates.
export const CONFIG_BUCKET = "config-broker-local";
export const CONFIG_TOPIC_ARN =
  "arn:aws:sns:eu-west-2:000000000000:gfr__sns___config_update";

const clientOptions = () => ({
  region: env.AWS_REGION,
  endpoint: env.AWS_ENDPOINT_URL,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

const s3 = new S3Client({ ...clientOptions(), forcePathStyle: true });
const sns = new SNSClient(clientOptions());
const sqs = new SQSClient(clientOptions());

const SEED_DEFINITION = join(
  import.meta.dirname,
  "..",
  "..",
  "compose/seed/pigs-might-fly/1.0.0/cw/cw.json",
);

export const aGrantCode = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;

// A real published definition, re-coded for a grant of the test's own.
export const workflowDefinition = (grantCode) => ({
  ...JSON.parse(readFileSync(SEED_DEFINITION, "utf8")),
  code: grantCode,
});

export const cwKey = (grantCode, version) =>
  `${grantCode}/${version}/cw/cw.json`;

export const manifestFor = (grantCode, version) => [
  cwKey(grantCode, version),
  `${grantCode}/${version}/metadata.json`,
];

export const putConfigFile = (key, body) =>
  s3.send(
    new PutObjectCommand({
      Bucket: CONFIG_BUCKET,
      Key: key,
      Body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const stringAttribute = (value) => ({ DataType: "String", StringValue: value });

// Shaped as the broker sends them. An attribute set to undefined is not sent,
// so a test can leave out one the broker always sends.
export const configAttributes = (attributes) =>
  Object.fromEntries(
    Object.entries({ status: "active", path: CONFIG_BUCKET, ...attributes })
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, stringAttribute(value)]),
  );

export const publishConfigVersion = ({ manifest, ...attributes }) =>
  sns.send(
    new PublishCommand({
      TopicArn: CONFIG_TOPIC_ARN,
      Message: JSON.stringify(manifest),
      MessageAttributes: configAttributes(attributes),
    }),
  );

export const createQueue = async (queueName) => {
  const { QueueUrl } = await sqs.send(
    new CreateQueueCommand({ QueueName: queueName }),
  );

  return QueueUrl;
};

export const purgeQueue = (queueUrl) =>
  sqs.send(new PurgeQueueCommand({ QueueUrl: queueUrl }));

export const sendConfigVersion = (queueUrl, { manifest, ...attributes }) =>
  sqs.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(manifest),
      MessageAttributes: configAttributes(attributes),
    }),
  );

// Received as SqsSubscriber receives them. A zero visibility timeout leaves
// the message on the queue, so the next receive redelivers it.
export const receiveMessage = async (queueUrl, { visibilityTimeout } = {}) => {
  const { Messages = [] } = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 5,
      VisibilityTimeout: visibilityTimeout,
      AttributeNames: ["All"],
      MessageAttributeNames: ["All"],
    }),
  );

  if (Messages.length === 0) {
    throw new Error(`No message arrived on ${queueUrl}`);
  }

  return Messages[0];
};
