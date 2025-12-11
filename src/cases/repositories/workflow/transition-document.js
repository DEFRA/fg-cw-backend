import { ActionDocument } from "./action-document.js";

export class TransitionDocument {
  constructor(props) {
    this.targetPosition = props.targetPosition.toString();
    this.checkTasks = props.checkTasks;
    this.action = props.action ? new ActionDocument(props.action) : null;
  }
}
