import Boom from "@hapi/boom";
import Joi from "joi";
import { assertInstanceOf } from "../../common/assert.js";
import { timelineEventTypeSchema } from "../schemas/cases/timeline/event-type.schema.js";
import { idSchema } from "../schemas/id.schema.js";
import { systemSchema } from "../schemas/system.schema.js";
import { EventEnums } from "./event-enums.js";
export class TimelineEvent {
  static validationSchema = Joi.object({
    eventType: timelineEventTypeSchema,
    createdBy: Joi.alternatives().try(idSchema, systemSchema),
    data: Joi.object().allow(null).optional(),
    commentRef: idSchema.allow(null),
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
    this.commentRef = value.commentRef;
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

  static createTimelineEvent(eventType, createdById, data, commentRef = null) {
    return new TimelineEvent({
      createdBy: createdById,
      eventType,
      commentRef,
      data,
    });
  }
}

export const toTimelineEvents = (props) => {
  return props?.map(toTimelineEvent) || [];
};

export const toTimelineEvent = (props) => {
  return new TimelineEvent(props);
};

export const assertIsTimelineEvent = (obj) => {
  return assertInstanceOf(obj, TimelineEvent, "TimelineEvent");
};
