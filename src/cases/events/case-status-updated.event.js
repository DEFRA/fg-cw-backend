import { CloudEvent } from "../../common/cloud-event.js";

export class CaseStatusUpdatedEvent extends CloudEvent {
  constructor({
    caseRef,
    workflowCode,
    previousStatus,
    currentStatus,
    configVersion = null,
  }) {
    super(
      "case.status.updated",
      {
        caseRef,
        workflowCode,
        previousStatus,
        currentStatus,
        ...(configVersion && { configVersion }),
      },
      `${caseRef}-${workflowCode}`,
    );
  }
}
