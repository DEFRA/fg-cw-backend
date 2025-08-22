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
    const stage = this.findStage(stageId);
    const taskGroup = stage?.taskGroups.find((tg) => tg.id === taskGroupId);
    const task = taskGroup?.tasks.find((t) => t.id === taskId);

    if (!task) {
      throw Boom.notFound(
        `Can not find Task with id ${taskId} from taskGroup ${taskGroupId} in stage ${stageId}`,
      );
    }

    return task;
  }

  validateStageActionComment({ stageId, actionId, comment }) {
    const stage = this.findStage(stageId);
    const action = this.findAction(stage, actionId);

    this.validateComment({ stageId, actionId, action, comment });

    return true;
  }

  findStage(stageId) {
    const stage = this.stages.find((s) => s.id === stageId);
    if (!stage) {
      throw Boom.badRequest(`Stage with id "${stageId}" not found`);
    }
    return stage;
  }

  findAction(stage, actionId) {
    const action = stage.actions.find((a) => a.id === actionId);
    if (!action) {
      throw Boom.badRequest(
        `Stage "${stage.id}" does not contain action with id "${actionId}"`,
      );
    }
    return action;
  }

  validateComment({ stageId, actionId, action, comment }) {
    if (this.isMissingRequiredComment(action, comment)) {
      throw Boom.badRequest(
        `Stage "${stageId}", Action "${actionId}" requires a comment`,
      );
    }
  }

  isMissingRequiredComment(action, comment) {
    return (
      action.comment && action.comment.type === "REQUIRED" && !comment?.trim()
    );
  }

  static createMock(props) {
    return new Workflow({
      ...createWorkflowMockData(),
      ...props,
    });
  }
}
