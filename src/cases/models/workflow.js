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
    this.definitions = props.definitions;
    this.externalActions = props.externalActions;
  }

  findTask(stageCode, taskGroupCode, taskCode) {
    const stage = this.findStage(stageCode);
    const taskGroup = stage?.taskGroups.find((tg) => tg.code === taskGroupCode);
    const task = taskGroup?.tasks.find((t) => t.code === taskCode);

    if (!task) {
      throw Boom.notFound(
        `Can not find Task with code ${taskCode} from taskGroup ${taskGroupCode} in stage ${stageCode}`,
      );
    }

    return task;
  }

  validateStageActionComment({ stageCode, actionCode, comment }) {
    const stage = this.findStage(stageCode);
    const action = this.findAction(stage, actionCode);
    this.validateComment({ stageCode, actionCode, action, comment });

    return true;
  }

  findStage(stageCode) {
    const stage = this.stages.find((s) => s.code === stageCode);
    if (!stage) {
      throw Boom.badRequest(`Stage with code "${stageCode}" not found`);
    }
    return stage;
  }

  findAction(stage, actionCode) {
    const action = stage.actions.find((a) => a.code === actionCode);
    if (!action) {
      throw Boom.badRequest(
        `Stage "${stage.code}" does not contain action with code "${actionCode}"`,
      );
    }
    return action;
  }

  validateComment({ stageCode, actionCode, action, comment }) {
    if (this.isMissingRequiredComment(action, comment)) {
      throw Boom.badRequest(
        `Stage "${stageCode}", Action "${actionCode}" requires a comment`,
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
