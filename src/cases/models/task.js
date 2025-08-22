import Joi from "joi";
import { statusSchema } from "../schemas/cases/stages/tasks/status.schema.js";
import { validateModel } from "./validate-model.js";

export class Task {
  static schema = Joi.object({
    id: Joi.string().required(),
    status: statusSchema.required(),
  }).label("TaskSchema");

  constructor(props) {
    const value = validateModel(props, Task.schema);
    this.id = value.id;
    this.status = value.status;
  }
}
