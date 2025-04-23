import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { config } from "../../src/config.js";
import { PurgeQueueCommand, SQSClient } from "@aws-sdk/client-sqs";

const sendSnsMessage = async (topicArn, message) => {
  const snsClient = new SNSClient({
    endpoint: config.get("aws.snsEndpoint") || "http://localhost:4566",
    region: config.get("aws.awsRegion") || "eu-west-2",
    credentials: {
      accessKeyId: config.get("aws.awsAccessKeyId") || "test",
      secretAccessKey: config.get("aws.awsSecretAccessKey") || "test"
    }
  });

  try {
    const command = new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(message)
    });

    return await snsClient.send(command);
  } catch (error) {
    console.error("Error publishing message to SNS:", error);
    throw error;
  }
  // Example usage:
  // const topicArn = 'arn:aws:sns:eu-west-2:000000000000:grant_application_created';
  // const message = { id: '123', status: 'approved' };
  // await sendSnsMessage(topicArn, message);
};

const purgeSqsQueue = async (queueUrl) => {
  const sqsClient = new SQSClient({
    endpoint: config.get("aws.sqsEndpoint") || "http://localhost:4566",
    region: config.get("aws.awsRegion") || "eu-west-2",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test"
    }
  });
  const command = new PurgeQueueCommand({
    QueueUrl: queueUrl
  });
  await sqsClient.send(command);
};
export { sendSnsMessage, purgeSqsQueue };
