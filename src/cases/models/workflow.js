import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { createWorkflowMockData } from "./workflow-mock-data.js";

export class Workflow {
  constructor(props) {
    this._id = props._id || new ObjectId().toHexString();
    this.code = props.code;
    this.pages = props.pages;
    this.stages = props.stages;
    this.requiredRoles = props.requiredRoles;
  }

  findTask(stageId, taskGroupId, taskId) {
    const stage = this.stages.find((s) => s.id === stageId);
    const taskGroup = stage?.taskGroups.find((tg) => tg.id === taskGroupId);
    const task = taskGroup?.tasks.find((t) => t.id === taskId);

    if (!task) {
      throw Boom.notFound(
        `Can not find Task with id ${taskId} from taskGroup ${taskGroupId} in stage ${stageId}`,
      );
    }

    return task;
  }

  static createMock(props) {
    return new Workflow({
      ...createWorkflowMockData(),
      ...props,
    });
  }
}
