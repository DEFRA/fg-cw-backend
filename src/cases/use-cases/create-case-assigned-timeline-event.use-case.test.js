import { describe, expect, it, vi } from "vitest";
import { TimelineEvent } from "../models/timeline-event.js";
import * as caseRepository from "../repositories/case.repository.js";
import { createCaseAssignedTimelineEvent } from "./create-case-assigned-timeline-event.use-case.js";

describe("create timeline event use case", () => {
  it("should call addtimeLineEvent", async () => {
    vi.spyOn(caseRepository, "addTimelineEvent").mockImplementation(() => {});

    const data = {
      data: {
        assignedTo: "Donatas",
      },
      caseId: "ABCD-1234",
      createdBy: "Someone Else",
    };

    const expected = {
      caseId: "ABCD-1234",
      createdBy: "Someone Else",
      eventType: TimelineEvent.eventTypes.CASE_ASSIGNED,
      data: {
        assignedTo: "Donatas",
      },
    };

    await createCaseAssignedTimelineEvent(data);
    expect(caseRepository.addTimelineEvent).toHaveBeenCalledWith(
      "ABCD-1234",
      expected,
    );
  });

  it("should handle setting user to null", async () => {
    vi.spyOn(caseRepository, "addTimelineEvent").mockImplementation(() => {});

    const data = {
      data: {
        assignedTo: null,
      },
      caseId: "ABCD-1234",
      createdBy: "Someone Else",
    };

    const expected = {
      caseId: "ABCD-1234",
      createdBy: "Someone Else",
      eventType: TimelineEvent.eventTypes.CASE_ASSIGNED,
      data: {
        assignedTo: null,
      },
    };

    await createCaseAssignedTimelineEvent(data);
    expect(caseRepository.addTimelineEvent).toHaveBeenCalledWith(
      "ABCD-1234",
      expected,
    );
  });
});
