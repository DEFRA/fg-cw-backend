import { EventEnums } from "./event-enums.js";

export class TimelineEvent {
  constructor(props) {
    this.createdAt = new Date().toISOString();
    this.eventType = props.eventType;
    this.createdBy = props.createdBy;
    this.description = EventEnums.eventDescriptions[props.eventType];
    this.data = props.data;
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
