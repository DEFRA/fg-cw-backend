import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { config } from "../config.js";

const region = config.get("aws.awsRegion") || "eu-west-2";
const endpoint = config.get("aws.snsEndpoint") || "http://localhost:4566";

export const snsClient = new SNSClient({ region, endpoint });

export const publish = async (topicArn, event) => {
  return snsClient.send(
    new PublishCommand({
      Message: JSON.stringify(event),
      TopicArn: topicArn
    })
  );
};
