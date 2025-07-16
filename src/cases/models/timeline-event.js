export class TimelineEvent {
  constructor(props) {
    this.createdAt = new Date().toISOString();
    this.eventType = props.eventType;
    this.createdBy = props.createdBy;
    this.description = TimelineEvent.eventDescriptions[props.eventType];
    this.data = props.data;
  }

  static createMock(props) {
    return new TimelineEvent({
      eventType: TimelineEvent.eventTypes.CASE_CREATED,
      createdBy: "Mickey Mouse",
      createdAt: "2025-06-16T09:01:14.072Z",
      description:
        TimelineEvent.eventDescriptions[TimelineEvent.eventTypes.CASE_CREATED],
      data: {
        someOtherDetail: "any string",
      },
      ...props,
    });
  }

  static eventTypes = {
    CASE_CREATED: "CASE_CREATED",
    CASE_ASSIGNED: "CASE_ASSIGNED",
    CASE_UNASSIGNED: "CASE_UNASSIGNED",
  };

  static eventDescriptions = {
    CASE_CREATED: "Case received",
    CASE_ASSIGNED: "Case assigned",
    CASE_UNASSIGNED: "Case unassigned",
  };
}
