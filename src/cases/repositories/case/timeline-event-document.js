export class TimelineEventDocument {
  constructor(props) {
    this.createdAt = props.createdAt;
    this.eventType = props.eventType;
    this.createdBy = props.createdBy;
    this.commentRef = props.comment ? props.comment.ref : null;
    this.description = props.description;
    if (props.descriptionVersion !== undefined) {
      this.descriptionVersion = props.descriptionVersion;
    }
    this.data = props.data;
  }
}
