import { CloudEvent } from "../../common/cloud-event.js";

export class CaseStageUpdatedEvent extends CloudEvent {
  constructor({ caseRef, previousStage, currentStage }) {
    super("case.stage.updated", {
      caseRef,
      previousStage,
      currentStage,
    });
  }
}
