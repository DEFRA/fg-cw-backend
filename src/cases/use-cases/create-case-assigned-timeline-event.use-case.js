import { TimelineEvent } from "../models/timeline-event.js";
import { addTimelineEvent } from "../repositories/case.repository.js";

export const createCaseAssignedTimelineEvent = async ({
  caseId,
  createdBy,
  data,
}) => {
  return addTimelineEvent(caseId, {
    caseId,
    createdBy,
    data,
    eventType: TimelineEvent.eventTypes.CASE_ASSIGNED,
  });
};
