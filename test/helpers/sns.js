import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { env } from "node:process";

export const publish = async (topicArn, message) => {
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
