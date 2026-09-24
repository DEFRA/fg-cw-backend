import { CommentDocument } from "./comment-document.js";

export class ValueOptionDocument {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.theme = props.theme;
    this.altName = props.altName;
    this.completes = props.completes;
    this.comment = props.comment ? new CommentDocument(props.comment) : null;
  }
}
