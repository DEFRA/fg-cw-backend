import { CloudEvent } from "../../common/cloud-event.js";

export class CaseStatusUpdatedEvent extends CloudEvent {
  constructor({ caseRef, previousStage, currentStage }) {
    super("case.status.updated", {
      caseRef,
      previousStage,
      currentStage,
    });
  }
}
