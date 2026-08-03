export class TaskDocument {
  constructor(props) {
    this.code = props.code;
    this.value = props.value;
    this.completed = props.completed;
    this.commentRefs = props.commentRefs || [];
    this.updatedAt = props.updatedAt;
    this.updatedBy = props.updatedBy;
  }
}
