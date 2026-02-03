import { CloudEvent } from "../../common/cloud-event.js";

export class CaseStatusUpdatedEvent extends CloudEvent {
  constructor({ caseRef, workflowCode, previousStatus, currentStatus }) {
    super(
      "case.status.updated",
      {
        caseRef,
        workflowCode,
        previousStatus,
        currentStatus,
      },
      `${caseRef}-${workflowCode}`,
    );
  }
}
