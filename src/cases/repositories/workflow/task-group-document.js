import { TaskDocument } from "./task-document.js";

export class TaskGroupDocument {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.tasks = props.tasks.map((task) => new TaskDocument(task));
  }
}
