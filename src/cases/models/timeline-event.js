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

  // TODO extract these static enums - they can be used for comments
  static eventTypes = {
    CASE_CREATED: "CASE_CREATED",
    CASE_ASSIGNED: "CASE_ASSIGNED",
    CASE_UNASSIGNED: "CASE_UNASSIGNED",
    TASK_COMPLETED: "TASK_COMPLETED",
    STAGE_COMPLETED: "STAGE_COMPLETED",
  };

  static eventDescriptions = {
    CASE_CREATED: "Case received",
    CASE_ASSIGNED: "Case assigned",
    CASE_UNASSIGNED: "Case unassigned",
    TASK_COMPLETED: "Task completed",
    STAGE_COMPLETED: "Stage completed",
  };
}
