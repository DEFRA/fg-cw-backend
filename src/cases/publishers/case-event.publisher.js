import { config } from "../../common/config.js";
import { publish } from "../../common/sns-client.js";
import { CaseStageUpdatedEvent } from "../events/case-stage-updated.event.js";
import { CaseStatusUpdatedEvent } from "../events/case-status-updated.event.js";

export const publishCaseStageUpdated = async ({
  caseRef,
  previousStage,
  currentStage,
}) => {
  const event = new CaseStageUpdatedEvent({
    caseRef,
    previousStage,
    currentStage,
  });
  await publish(config.get("aws.caseStageUpdatedTopicArn"), event);
};

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
