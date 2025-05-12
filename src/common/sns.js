import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { config } from "../config.js";

const region = config?.aws?.awsRegion || "eu-west-2";
const endpoint = config?.aws?.snsEndpoint || "http://localhost:4566";

export const snsClient = new SNSClient({ region, endpoint });

export const publish = async (topicArn, message) => {
  return snsClient.send(
    new PublishCommand({
      Message: JSON.stringify(message),
      TopicArn: topicArn
    })
  );
};
