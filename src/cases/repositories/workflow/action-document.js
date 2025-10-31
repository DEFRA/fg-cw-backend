import { CommentDocument } from "./comment-document.js";

export class ActionDocument {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.comment = props.comment ? new CommentDocument(props.comment) : null;
  }
}
