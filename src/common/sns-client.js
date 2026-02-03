import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { config } from "./config.js";

const snsClient = new SNSClient({
  region: config.get("aws.region"),
  endpoint: config.get("aws.endpointUrl"),
});

export const publish = async (topic, data, messageGroupId) => {
  await snsClient.send(
    new PublishCommand({
      TopicArn: topic,
      Message: JSON.stringify(data),
      MessageGroupId: messageGroupId,
    }),
  );
};
