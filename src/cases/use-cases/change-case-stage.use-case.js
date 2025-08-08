import Boom from "@hapi/boom";

import { getAuthenticatedUser } from "../../common/auth.js";
import { EventEnums } from "../models/event-enums.js";
import { TimelineEvent } from "../models/timeline-event.js";
import { publishCaseStageUpdated } from "../publishers/case-event.publisher.js";
import { updateStage } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";

export const changeCaseStageUseCase = async (caseId) => {
  const kase = await findCaseByIdUseCase(caseId);

  const currentStageIndex = kase.stages.findIndex(
    (stage) => stage.id === kase.currentStage,
  );

  // If current stage is not found or is the last stage, throw error
  if (
    currentStageIndex === -1 ||
    currentStageIndex === kase.stages.length - 1
  ) {
    throw Boom.notFound(
      `Cannot progress case ${caseId} from stage ${kase.currentStage}`,
    );
  }

  // Get the next stage ID
  const nextStage = kase.stages[currentStageIndex + 1].id;

  await updateStage(
    caseId,
    nextStage,
    TimelineEvent.createTimelineEvent(
      EventEnums.eventTypes.STAGE_COMPLETED,
      getAuthenticatedUser().id,
      {
        caseId,
        stageId: nextStage,
      },
    ),
  );

  await publishCaseStageUpdated({
    caseRef: kase.caseRef,
    previousStage: kase.currentStage,
    currentStage: nextStage,
  });
};
