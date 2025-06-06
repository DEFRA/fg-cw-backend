import { config } from "../../common/config.js";
import { publish } from "../../common/sns-client.js";
import { CaseStageUpdatedEvent } from "../events/case-stage-updated.event.js";

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
