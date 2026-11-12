import Boom from "@hapi/boom";
import { describe, expect, it, vi } from "vitest";
import { TimelineEventDocument } from "../repositories/case/timeline-event-document.js";
import { Case } from "./case.js";
import { EventEnums } from "./event-enums.js";
import { Position } from "./position.js";
import { formatTimelineItemDescription } from "./timeline-description.js";
import { TimelineEvent, toTimelineEvent } from "./timeline-event.js";
import { Workflow } from "./workflow.js";

const {
  TASK_COMPLETED,
  TASK_UPDATED,
  STAGE_COMPLETED,
  PHASE_COMPLETED,
  CASE_STATUS_CHANGED,
} = EventEnums.eventTypes;
const data = {
  phaseCode: "PHASE_1",
  stageCode: "STAGE_1",
  statusCode: "STATUS_1",
  taskGroupCode: "TASK_GROUP_1",
  taskCode: "TASK_1",
  actionCode: "ACTION_1",
};
const eventFor = (eventType, props = {}) =>
  TimelineEvent.createMock({
    eventType,
    description: EventEnums.eventDescriptions[eventType],
    data: { ...data },
    ...props,
  });

describe("historical timeline descriptions", () => {
  it.each([
    [TASK_COMPLETED, "Task 'Task 1' completed"],
    [TASK_UPDATED, "Task 'Task 1' updated"],
    [STAGE_COMPLETED, "Stage 'Stage 1' outcome (Action 1)"],
    [PHASE_COMPLETED, "Phase 'Phase 1' completed"],
    [CASE_STATUS_CHANGED, "Status changed to 'Stage status 1'"],
  ])(
    "persists and reloads the original %s wording without workflow lookups",
    (type, description) => {
      const workflow = Workflow.createMock();
      const event = eventFor(type);
      event.snapshotDescription(workflow);
      const document = JSON.parse(
        JSON.stringify(new TimelineEventDocument(event)),
      );
      const restored = toTimelineEvent(document, []);

      expect(restored).toMatchObject({
        description,
        descriptionVersion: 1,
        data,
        createdAt: event.createdAt,
        createdBy: event.createdBy,
      });
      // Rendering must work even when none of the old workflow is available.
      expect(formatTimelineItemDescription(restored, undefined)).toBe(
        description,
      );
      expect(document).toEqual(new TimelineEventDocument(event));
    },
  );

  it.each([
    [TASK_COMPLETED, "phaseCode"],
    [TASK_UPDATED, "stageCode"],
    [TASK_COMPLETED, "taskGroupCode"],
    [TASK_UPDATED, "taskCode"],
    [PHASE_COMPLETED, "phaseCode"],
    [STAGE_COMPLETED, "phaseCode"],
    [STAGE_COMPLETED, "stageCode"],
    [STAGE_COMPLETED, "statusCode"],
    [CASE_STATUS_CHANGED, "phaseCode"],
    [CASE_STATUS_CHANGED, "stageCode"],
    [CASE_STATUS_CHANGED, "statusCode"],
  ])("falls back for a removed %s reference: %s", (type, field) => {
    const workflow = Workflow.createMock();
    const event = eventFor(type, {
      description: "Original stored description",
      data: { ...data, [field]: "REMOVED" },
    });
    expect(formatTimelineItemDescription(event, workflow)).toBe(
      "Original stored description",
    );
    const withoutDescription = { ...event, description: undefined };
    expect(formatTimelineItemDescription(withoutDescription, workflow)).toBe(
      EventEnums.eventDescriptions[type],
    );
    expect(event.descriptionVersion).toBeUndefined();
    expect(event.description).toBe("Original stored description");
  });

  it("preserves the existing fallback for a removed action", () => {
    const event = eventFor(STAGE_COMPLETED, {
      data: { ...data, actionCode: "REMOVED" },
    });
    expect(formatTimelineItemDescription(event, Workflow.createMock())).toBe(
      "Stage 'Stage 1' completed",
    );
  });

  it.each([
    new Error("unexpected failure"),
    Boom.badImplementation("unexpected failure"),
    Boom.notFound("unexpected failure"),
  ])("propagates unexpected formatter errors: %s", (error) => {
    const workflow = Workflow.createMock();
    vi.spyOn(workflow, "findPhase").mockImplementation(() => {
      throw error;
    });
    expect(() =>
      formatTimelineItemDescription(eventFor(TASK_COMPLETED), workflow),
    ).toThrow(error);
  });

  it("does not turn missing references into snapshots during an action", () => {
    const event = eventFor(TASK_COMPLETED, {
      data: { ...data, taskGroupCode: "REMOVED" },
    });
    expect(() => event.snapshotDescription(Workflow.createMock())).toThrow(
      'TaskGroup with code "REMOVED" not found',
    );
    expect(event.descriptionVersion).toBeUndefined();
  });

  it("does not mark legacy descriptions as snapshots when saving them", () => {
    const restored = toTimelineEvent(
      new TimelineEventDocument(eventFor(TASK_COMPLETED)),
      [],
    );
    expect(restored.descriptionVersion).toBeUndefined();
    expect(formatTimelineItemDescription(restored, Workflow.createMock())).toBe(
      "Task 'Task 1' completed",
    );
  });
});

describe("recording snapshots through case actions", () => {
  it.each([true, false])(
    "snapshots a task change (completed=%s) before the workflow changes",
    (completed) => {
      const kase = Case.createMock();
      const workflow = Workflow.createMock();
      kase.setTaskValue({
        workflow,
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        value: "COMPLETE",
        completed,
        updatedBy: "System",
        comment: "Checked evidence",
      });
      const event = kase.timeline[0];
      expect(event).toMatchObject({
        descriptionVersion: 1,
        description: `Task 'Task 1' ${completed ? "completed" : "updated"}`,
        data: {
          phaseCode: kase.position.phaseCode,
          stageCode: kase.position.stageCode,
          caseId: kase._id,
          taskGroupCode: "TASK_GROUP_1",
          taskCode: "TASK_1",
        },
        createdBy: "System",
        comment: { text: "Checked evidence" },
      });
      workflow.phases[0].stages[0].taskGroups = [];
      expect(formatTimelineItemDescription(event, workflow)).toBe(
        event.description,
      );
    },
  );

  it("captures input task wording without a completion suffix", () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    workflow.findTask(data).input = { type: "text" };
    kase.setTaskValue({
      workflow,
      taskGroupCode: "TASK_GROUP_1",
      taskCode: "TASK_1",
      value: "Reference",
      completed: true,
      updatedBy: "System",
    });
    expect(kase.timeline[0]).toMatchObject({
      descriptionVersion: 1,
      description: "Task 'Task 1'",
    });
  });

  it("captures the stage outcome before moving the case", () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;
    kase.updateStageOutcome({
      workflow,
      actionCode: "ACTION_1",
      createdBy: "System",
    });
    expect(kase.timeline[0]).toMatchObject({
      descriptionVersion: 1,
      description: "Stage 'Stage 1' outcome (Action 1)",
      data: {
        phaseCode: "PHASE_1",
        stageCode: "STAGE_1",
        statusCode: "STATUS_1",
        actionCode: "ACTION_1",
      },
    });
  });

  it("captures phase, stage and destination status descriptions when progressing", () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;
    kase.progressTo({
      workflow,
      position: Position.from("PHASE_2:STAGE_1:STATUS_1"),
      createdBy: "System",
    });
    expect(kase.timeline.slice(0, 3)).toMatchObject([
      {
        eventType: CASE_STATUS_CHANGED,
        descriptionVersion: 1,
        description: "Status changed to 'Stage status 1'",
      },
      {
        eventType: STAGE_COMPLETED,
        descriptionVersion: 1,
        description: "Stage 'Stage 1' completed",
      },
      {
        eventType: PHASE_COMPLETED,
        descriptionVersion: 1,
        description: "Phase 'Phase 1' completed",
      },
    ]);
  });

  it("keeps current task validation strict and leaves state untouched on failure", () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    workflow.phases[0].stages[0].taskGroups = [];
    const before = JSON.stringify(kase);
    expect(() =>
      kase.setTaskValue({
        workflow,
        taskGroupCode: "TASK_GROUP_1",
        taskCode: "TASK_1",
        value: "COMPLETE",
        completed: true,
        updatedBy: "System",
      }),
    ).toThrow('TaskGroup with code "TASK_GROUP_1" not found');
    expect(JSON.stringify(kase)).toBe(before);
  });
});
