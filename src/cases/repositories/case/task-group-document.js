import { TaskDocument } from "./task-document.js";

export class TaskGroupDocument {
  constructor(props) {
    this.code = props.code;
    this.tasks = props.tasks.map((task) => new TaskDocument(task));
  }
}
