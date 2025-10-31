import { TaskGroupDocument } from "./task-group-document.js";

export class StageDocument {
  constructor(props) {
    this.code = props.code;
    this.outcome = props.outcome || null;
    this.taskGroups = props.taskGroups.map(
      (taskGroup) => new TaskGroupDocument(taskGroup),
    );
  }
}
