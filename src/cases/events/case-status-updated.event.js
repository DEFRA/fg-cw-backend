import { CloudEvent } from "../../common/cloud-event.js";

export class CaseStatusUpdatedEvent extends CloudEvent {
  constructor({ caseRef, previousStatus, currentStatus }) {
    super("case.status.updated", {
      caseRef,
      previousStatus,
      currentStatus,
    });
  }
}
