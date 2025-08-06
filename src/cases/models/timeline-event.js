import { EventEnums } from "./event-enums.js";

export class TimelineEvent {
  constructor(props) {
    this.createdAt = props.createdAt || new Date().toISOString();
    this.eventType = props.eventType;
    this.createdBy = props.createdBy;
    this.description = EventEnums.eventDescriptions[props.eventType];
    this.data = props.data;
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
      createdBy: "Mickey Mouse",
      createdAt: "2025-06-16T09:01:14.072Z",
      description:
        EventEnums.eventDescriptions[EventEnums.eventTypes.CASE_CREATED],
      data: {
        someOtherDetail: "any string",
      },
      ...props,
    });
  }
}

export const toTimelineEvents = (props) => {
  return props?.map(toTimelineEvent) || [];
};

export const toTimelineEvent = (props) => {
  return new TimelineEvent(props);
};
