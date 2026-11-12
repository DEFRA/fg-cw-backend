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

const recordProgressionEvent = (eventType, command) => {
  switch (eventType) {
    case STAGE_COMPLETED:
      return TimelineEvent.createStageCompleted(command);
    case PHASE_COMPLETED:
      return TimelineEvent.createPhaseCompleted(command);
    case CASE_STATUS_CHANGED:
      return TimelineEvent.createCaseStatusChanged(command);
    default:
      throw new Error(`Unsupported test event: ${eventType}`);
  }
};

const recordEvent = (eventType, workflow, props = {}) => {
  const command = {
    data: { ...data },
    createdBy: "System",
    workflow,
    ...props,
  };
  if ([TASK_COMPLETED, TASK_UPDATED].includes(eventType)) {
    return TimelineEvent.createTaskChanged({
      ...command,
      completed: eventType === TASK_COMPLETED,
    });
  }
  return recordProgressionEvent(eventType, command);
};

describe("historical timeline descriptions", () => {
  it.each([
    [
      TASK_COMPLETED,
      { taskName: "Task 1", isInput: false },
      "Task 'Task 1' completed",
    ],
    [
      TASK_UPDATED,
      { taskName: "Task 1", isInput: false },
      "Task 'Task 1' updated",
    ],
    [
      STAGE_COMPLETED,
      { stageName: "Stage 1", actionName: "Action 1" },
      "Stage 'Stage 1' outcome (Action 1)",
    ],
    [PHASE_COMPLETED, { phaseName: "Phase 1" }, "Phase 'Phase 1' completed"],
    [
      CASE_STATUS_CHANGED,
      { statusName: "Stage status 1" },
      "Status changed to 'Stage status 1'",
    ],
  ])(
    "persists the historical %s names and renders without a workflow",
    (type, context, description) => {
      const event = recordEvent(type, Workflow.createMock());
      const document = JSON.parse(
        JSON.stringify(new TimelineEventDocument(event)),
      );
      const restored = toTimelineEvent(document, []);
      expect(restored).toMatchObject({
        recordedContext: context,
        data,
        description: EventEnums.eventDescriptions[type],
        createdAt: event.createdAt,
        createdBy: "System",
      });
      expect(formatTimelineItemDescription(restored, undefined)).toBe(
        description,
      );
      expect(document).toEqual(new TimelineEventDocument(event));
    },
  );

  it("loads incomplete stored context and falls back safely", () => {
    const workflow = Workflow.createMock();
    vi.spyOn(workflow, "hasTask").mockImplementation(() => {
      throw new Error("Historical context must not use today's workflow");
    });
    const stored = {
      ...eventFor(TASK_COMPLETED),
      recordedContext: { taskName: "Task" },
    };
    const kase = Case.createMock({ timeline: [stored] });
    const restored = kase.timeline[0];
    expect(restored.recordedContext).toEqual({ taskName: "Task" });
    expect(formatTimelineItemDescription(restored, workflow)).toBe(
      "Task completed",
    );
  });

  it("accepts extra stored context fields without losing the known historical names", () => {
    const restored = toTimelineEvent(
      {
        ...eventFor(TASK_COMPLETED),
        recordedContext: {
          taskName: "Original task",
          isInput: false,
          futureField: "Added later",
        },
      },
      [],
    );
    expect(formatTimelineItemDescription(restored, undefined)).toBe(
      "Task 'Original task' completed",
    );
  });

  it("uses stored wording when an event has context but no registered formatter", () => {
    const event = TimelineEvent.createMock({ description: "Stored wording" });
    vi.spyOn(event, "contextFor").mockReturnValue({
      futureField: "Added later",
    });
    expect(formatTimelineItemDescription(event, undefined)).toBe(
      "Stored wording",
    );
  });

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
    const withoutDescription = new TimelineEvent({
      ...event,
      description: undefined,
    });
    expect(formatTimelineItemDescription(withoutDescription, workflow)).toBe(
      EventEnums.eventDescriptions[type],
    );
    expect(event.recordedContext).toBeUndefined();
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

  it("rejects a missing reference when recording an event", () => {
    expect(() =>
      recordEvent(TASK_COMPLETED, Workflow.createMock(), {
        data: { ...data, taskGroupCode: "REMOVED" },
      }),
    ).toThrow('TaskGroup with code "REMOVED" not found');
  });

  it("does not mark legacy descriptions as snapshots when saving them", () => {
    const restored = toTimelineEvent(
      new TimelineEventDocument(eventFor(TASK_COMPLETED)),
      [],
    );
    expect(restored.recordedContext).toBeUndefined();
    expect(formatTimelineItemDescription(restored, Workflow.createMock())).toBe(
      "Task 'Task 1' completed",
    );
  });
});

describe("recording historical facts through case actions", () => {
  it.each([true, false])(
    "records names for a task change (completed=%s) before the workflow changes",
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
        recordedContext: { taskName: "Task 1", isInput: false },
        description: completed ? "Task completed" : "Task updated",
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
      workflow.findTask(data).name = "Renamed task";
      workflow.findTask(data).input = { type: "text" };
      expect(formatTimelineItemDescription(event, workflow)).toBe(
        `Task 'Task 1' ${completed ? "completed" : "updated"}`,
      );
      workflow.phases[0].stages[0].taskGroups = [];
      expect(formatTimelineItemDescription(event, workflow)).toBe(
        `Task 'Task 1' ${completed ? "completed" : "updated"}`,
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
      recordedContext: { taskName: "Task 1", isInput: true },
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
      recordedContext: { stageName: "Stage 1", actionName: "Action 1" },
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
        recordedContext: { statusName: "Stage status 1" },
      },
      {
        eventType: STAGE_COMPLETED,
        recordedContext: { stageName: "Stage 1", actionName: null },
      },
      {
        eventType: PHASE_COMPLETED,
        recordedContext: { phaseName: "Phase 1" },
      },
    ]);
  });

  it("leaves progression untouched if the destination context cannot be recorded", () => {
    const kase = Case.createMock();
    const workflow = Workflow.createMock();
    kase.phases[0].stages[0].taskGroups[0].tasks[0].completed = true;
    workflow.phases.pop();
    const before = JSON.stringify(kase);
    expect(() =>
      kase.progressTo({
        workflow,
        position: Position.from("PHASE_2:STAGE_1:STATUS_1"),
        createdBy: "System",
      }),
    ).toThrow('Phase with code "PHASE_2" not found');
    expect(JSON.stringify(kase)).toBe(before);
  });

  it("validates recorded facts strictly when creating a new event", () => {
    const workflow = Workflow.createMock();
    workflow.findTask(data).name = undefined;
    const kase = Case.createMock();
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
    ).toThrow("Invalid recorded timeline context");
    expect(JSON.stringify(kase)).toBe(before);
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

const workflowWithUnnamedNodes = (name) => {
  const stage = (targetPosition) => ({
    code: "STAGE_1",
    name,
    taskGroups: [],
    statuses: [
      {
        code: "STATUS_1",
        name,
        transitions: targetPosition
          ? [
              {
                targetPosition,
                checkTasks: false,
                action: { code: "ACTION_1", name, checkTasks: false },
              },
            ]
          : [],
      },
    ],
  });
  return Workflow.fromDefinition(
    {
      code: "workflow-code",
      requiredRoles: { allOf: [], anyOf: [] },
      phases: [
        { code: "PHASE_1", name, stages: [stage("PHASE_2:STAGE_1:STATUS_1")] },
        { code: "PHASE_2", name, stages: [stage()] },
      ],
    },
    "1.0.0",
  );
};

describe("valid workflows without display names", () => {
  it.each([undefined, "", "   "])(
    "can progress without a display name (%s)",
    (name) => {
      const workflow = workflowWithUnnamedNodes(name);
      const kase = Case.createMock();
      kase.progressTo({
        workflow,
        position: Position.from("PHASE_2:STAGE_1:STATUS_1"),
        createdBy: "System",
      });
      expect(kase.position.phaseCode).toBe("PHASE_2");
      expect(
        kase.timeline
          .slice(0, 3)
          .map((event) => formatTimelineItemDescription(event, undefined)),
      ).toEqual(["Case status changed", "Stage completed", "Phase completed"]);
    },
  );

  it.each([undefined, "", "   "])(
    "can complete an action without a display name (%s)",
    (name) => {
      const workflow = workflowWithUnnamedNodes(name);
      const kase = Case.createMock();
      kase.updateStageOutcome({
        workflow,
        actionCode: "ACTION_1",
        createdBy: "System",
      });
      expect(kase.position.phaseCode).toBe("PHASE_2");
      expect(formatTimelineItemDescription(kase.timeline[0], undefined)).toBe(
        "Stage completed",
      );
    },
  );
});
