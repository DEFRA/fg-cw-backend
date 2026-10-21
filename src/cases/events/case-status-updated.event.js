import { CloudEvent } from "../../common/cloud-event.js";
import { config } from "../../common/config.js";
import { caseRefsOf } from "../../events/case-refs.js";
import { OUTBOX, defineEventType } from "../../events/event-types.js";

export const caseStatusUpdated = defineEventType({
  name: "CaseStatusUpdated",
  sentAs: `cloud.defra.${config.get("cdpEnvironment")}.${config.get("serviceName")}.case.status.updated`,
  boxes: [OUTBOX],
  refs: ({ data }) => caseRefsOf(data?.workflowCode, data?.caseRef),
});

export class CaseStatusUpdatedEvent extends CloudEvent {
  constructor({
    caseRef,
    workflowCode,
    previousStatus,
    currentStatus,
    currentConfigVersion = null,
  }) {
    super(
      "case.status.updated",
      {
        caseRef,
        workflowCode,
        previousStatus,
        currentStatus,
        ...(currentConfigVersion && { currentConfigVersion }),
      },
      `${caseRef}-${workflowCode}`,
    );
  }
}
