export class TimelineEventDocument {
  constructor(props) {
    this.createdAt = props.createdAt;
    this.eventType = props.eventType;
    this.createdBy = props.createdBy.name; // TODO: This should be using id but we are defaulting name to "System"
    this.description = props.description;
    this.data = props.data;
  }
}
