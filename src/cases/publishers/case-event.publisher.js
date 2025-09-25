import { config } from "../../common/config.js";
import { publish } from "../../common/sns-client.js";
import { CaseStatusUpdatedEvent } from "../events/case-status-updated.event.js";

export const publishCaseStatusUpdated = async ({
  caseRef,
  workflowCode,
  previousStatus,
  currentStatus,
}) => {
  const event = new CaseStatusUpdatedEvent({
    caseRef,
    workflowCode,
    previousStatus,
    currentStatus,
  });
  await publish(config.get("aws.sns.caseStatusUpdatedTopicArn"), event);
};
