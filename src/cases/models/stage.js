import Joi from "joi";
import { TaskGroup } from "./taskGroup.js";
import { validateModel } from "./validate-model.js";

export class Stage {
  static schema = Joi.object({
    id: Joi.string().required(),
    taskGroups: Joi.array().items(TaskGroup.schema).required(),
    outcome: Joi.object({
      actionId: Joi.string().required(),
      commentRef: Joi.string().optional(),
      createdBy: Joi.string().required(),
      createdAt: Joi.string().isoDate(),
    })
      .allow(null)
      .optional(),
  }).label("StageSchema");

  constructor(props) {
    const value = validateModel(props, Stage.schema);
    this.id = value.id;
    this.taskGroups = value.taskGroups.map((tg) => new TaskGroup(tg));
    this.outcome = value.outcome;
  }

  setOutcome({ actionId, commentRef, createdBy }) {
    this.outcome = {
      actionId,
      createdBy,
      createdAt: new Date().toISOString(),
    };

    if (commentRef) {
      this.outcome.commentRef = commentRef;
    }
  }

  allTasksComplete() {
    return this.taskGroups
      .flatMap((group) => group.tasks)
      .every((task) => task.status === "complete");
  }
}

export const toStages = (stages) => {
  return stages?.map((stage) => new Stage(stage)) || [];
};
