export class TaskDocument {
  constructor(props) {
    this.code = props.code;
    this.status = props.status;
    this.commentRef = props.commentRef;
    this.updatedAt = props.updatedAt;
    this.updatedBy = props.updatedBy;
  }
}
