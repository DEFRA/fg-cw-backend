import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { config } from "../config.js";
import { randomUUID } from "crypto";

const region = config.get("aws.awsRegion") || "eu-west-2";
const endpoint = config.get("aws.snsEndpoint") || "http://localhost:4566";

export const snsClient = new SNSClient({ region, endpoint });

export const publish = async (topicArn, message, traceId) => {
  const event = {
    id: randomUUID(),
    source: config.get("serviceName"),
    specVersion: "1.0",
    type: `cloud.defra.${config.get("cdpEnvironment")}.${config.get("serviceName")}.case.stage.updated`,
    data: { ...message, traceId }
  };

  return snsClient.send(
    new PublishCommand({
      Message: JSON.stringify(event),
      TopicArn: topicArn
    })
  );
};
