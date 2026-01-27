export class TaskDocument {
  constructor(props) {
    this.code = props.code;
    this.status = props.status;
    this.completed = props.completed;
    this.commentRefs = props.commentRefs || [];
    this.updatedAt = props.updatedAt;
    this.updatedBy = props.updatedBy;
  }
}
