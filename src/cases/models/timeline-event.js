import Boom from "@hapi/boom";
import Joi from "joi";
import { assertInstanceOf } from "../../common/assert.js";
import { timelineEventTypeSchema } from "../schemas/cases/timeline/event-type.schema.js";
import { idSchema } from "../schemas/id.schema.js";
import { systemSchema } from "../schemas/system.schema.js";
import { Comment } from "./comment.js";
import { EventEnums } from "./event-enums.js";

export class TimelineEvent {
  static validationSchema = Joi.object({
    eventType: timelineEventTypeSchema.required(),
    createdBy: Joi.alternatives().try(idSchema, systemSchema),
    data: Joi.object().allow(null).optional(),
    comment: Comment.validationSchema.allow(null).optional(),
    createdAt: Joi.string().isoDate(),
    description: Joi.string(),
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

  static create({ eventType, data = null, text, createdBy }) {
    const comment = Comment.createOptionalComment({
      type: eventType,
      text,
      createdBy,
    });

    return new TimelineEvent({
      eventType,
      comment,
      data,
      createdBy,
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

  static createStageCompleted({ data, createdBy }) {
    return TimelineEvent.create({
      eventType: EventEnums.eventTypes.STAGE_COMPLETED,
      data,
      createdBy,
    });
  }

  static createTaskCompleted({ data, createdBy }) {
    return TimelineEvent.create({
      eventType: EventEnums.eventTypes.TASK_COMPLETED,
      data,
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
