export class TimelineEventDocument {
  constructor(props) {
    this.createdAt = props.createdAt;
    this.eventType = props.eventType;
    this.createdBy = props.createdBy;
    this.commentRef = props.comment ? props.comment.ref : null;
    this.description = props.description;
    this.data = props.data;
  }
}
