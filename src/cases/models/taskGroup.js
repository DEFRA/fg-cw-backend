import Joi from "joi";
import { Task } from "./task.js";
import { validateModel } from "./validate-model.js";

export class TaskGroup {
  static schema = Joi.object({
    id: Joi.string().required(),
    tasks: Joi.array().items(Task.schema).required(),
  }).label("TaskGroupSchema");

  constructor(props) {
    const value = validateModel(props, TaskGroup.schema);
    this.id = value.id;
    this.tasks = value.tasks.map((task) => new Task(task)) || [];
  }
}
