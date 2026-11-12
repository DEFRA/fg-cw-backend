import Boom from "@hapi/boom";
import Joi from "joi";
import { assertInstanceOf } from "../../common/assert.js";
import { timelineEventTypeSchema } from "../schemas/cases/timeline/event-type.schema.js";
import { idSchema } from "../schemas/id.schema.js";
import { systemSchema } from "../schemas/system.schema.js";
import { Comment } from "./comment.js";
import { EventEnums } from "./event-enums.js";
import {
  captureTaskContext,
  captureStageContext,
  capturePhaseContext,
  captureStatusContext,
  readRecordedTimelineContext,
  resolveLegacyTimelineContext,
} from "./timeline-event-context.js";

export class TimelineEvent {
  static validationSchema = Joi.object({
    eventType: timelineEventTypeSchema.required(),
    createdBy: Joi.alternatives().try(idSchema, systemSchema),
    data: Joi.object().allow(null).optional(),
    comment: Comment.validationSchema.allow(null).optional(),
    createdAt: Joi.string().isoDate(),
    description: Joi.string(),
    recordedContext: Joi.any().optional(),
  }).label("TimelineValidationSchema");

  constructor(props) {
    const { error, value } = TimelineEvent.validationSchema.validate(props, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid TimelineEvent: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this.createdAt = value.createdAt || new Date().toISOString();
    this.eventType = value.eventType;
    this.createdBy = value.createdBy;
    this.comment = value.comment;
    this.description =
      value.description || EventEnums.eventDescriptions[value.eventType];
    this.data = value.data;
    this.recordedContext = value.recordedContext;
  }

  contextFor(workflow) {
    if (this.recordedContext !== undefined) {
      return readRecordedTimelineContext(this.eventType, this.recordedContext);
    }
    return resolveLegacyTimelineContext(this.eventType, this.data, workflow);
  }

  getUserIds() {
    const userIds = new Set();

    userIds.add(this.createdBy);

    if (this.data?.assignedTo) {
      userIds.add(this.data.assignedTo);
    }

    return [...userIds];
  }

  static createMock(props) {
    return new TimelineEvent({
      eventType: EventEnums.eventTypes.CASE_CREATED,
      createdBy: "System",
      createdAt: "2025-06-16T09:01:14.072Z",
      description:
        EventEnums.eventDescriptions[EventEnums.eventTypes.CASE_CREATED],
      data: {
        someOtherDetail: "any string",
      },
      ...props,
    });
  }

  static create({
    eventType,
    data = null,
    text,
    description,
    createdBy,
    recordedContext,
  }) {
    const comment = Comment.createOptionalComment({
      type: eventType,
      text,
      createdBy,
    });

    return new TimelineEvent({
      eventType,
      comment,
      data,
      description,
      createdBy,
      recordedContext,
    });
  }

  static createAssignUser({ eventType, data, text, createdBy }) {
    return TimelineEvent.create({
      eventType,
      data,
      text,
      createdBy,
    });
  }

  static createNoteAdded({ text, createdBy }) {
    return TimelineEvent.create({
      eventType: EventEnums.eventTypes.NOTE_ADDED,
      text,
      createdBy,
    });
  }

  static createTaskChanged({ completed, data, text, createdBy, workflow }) {
    const eventType = completed
      ? EventEnums.eventTypes.TASK_COMPLETED
      : EventEnums.eventTypes.TASK_UPDATED;
    return TimelineEvent.create({
      eventType,
      data,
      text,
      createdBy,
      recordedContext: captureTaskContext(data, workflow),
    });
  }

  static createPhaseCompleted({ data, createdBy, workflow }) {
    return TimelineEvent.create({
      eventType: EventEnums.eventTypes.PHASE_COMPLETED,
      recordedContext: capturePhaseContext(data, workflow),
      data,
      createdBy,
    });
  }

  static createStageCompleted({ data, text, createdBy, workflow }) {
    return TimelineEvent.create({
      eventType: EventEnums.eventTypes.STAGE_COMPLETED,
      recordedContext: captureStageContext(data, workflow),
      data,
      text,
      createdBy,
    });
  }

  static createCaseStatusChanged({ data, createdBy, workflow }) {
    return TimelineEvent.create({
      eventType: EventEnums.eventTypes.CASE_STATUS_CHANGED,
      recordedContext: captureStatusContext(data, workflow),
      data,
      createdBy,
    });
  }

  static createExternalActionTriggered({ actionName, createdBy }) {
    return TimelineEvent.create({
      eventType: EventEnums.eventTypes.EXTERNAL_ACTION_TRIGGERED,
      data: { actionName },
      description: `Action - ${actionName}`,
      createdBy,
    });
  }
}

export const toTimelineEvents = (timelineEventDocs, comments) => {
  return (
    timelineEventDocs?.map((timelineEventDoc) =>
      toTimelineEvent(timelineEventDoc, comments),
    ) || []
  );
};

export const toTimelineEvent = (timelineEventDoc, comments) => {
  const comment = timelineEventDoc.commentRef
    ? comments.find((c) => c.ref === timelineEventDoc.commentRef)
    : null;

  return new TimelineEvent({ ...timelineEventDoc, comment });
};

export const assertIsTimelineEvent = (obj) => {
  return assertInstanceOf(obj, TimelineEvent, "TimelineEvent");
};
