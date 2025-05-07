import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { config } from "../config.js";

const snsClient = new SNSClient({
  region: process.env.AWS_REGION,
  endpoint: process.env.SNS_ENDPOINT
});

export const snsPublisherService = {
  publishApplicationApproved: async (message) => {
    const params = {
      TopicArn: config.get("aws.grantApplicationApprovedTopicArn"),
      Message: JSON.stringify(message)
    };

    console.log("SNS message published:", params);

    await snsClient.send(new PublishCommand(params));
  }
};
