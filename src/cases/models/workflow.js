import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { createPagesMock } from "./create-pages-mock.js";
import { Permissions } from "./permissions.js";
import { WorkflowPhase } from "./workflow-phase.js";

export class Workflow {
  constructor(props) {
    this._id = props._id || new ObjectId().toHexString();
    this.code = props.code;
    this.pages = props.pages;
    this.phases = props.phases;
    this.requiredRoles = props.requiredRoles;
    this.definitions = props.definitions;
  }

  findTask({ phaseCode, stageCode, taskGroupCode, taskCode }) {
    const task = this.findPhase(phaseCode)
      .findStage(stageCode)
      .findTaskGroup(taskGroupCode)
      .findTask(taskCode);

    return task;
  }

  validateStageActionComment({ phaseCode, stageCode, actionCode, comment }) {
    const stage = this.findPhase(phaseCode).findStage(stageCode);
    const action = this.findAction(stage, actionCode);
    this.validateComment({ phaseCode, stageCode, actionCode, action, comment });

    return true;
  }

  findPhase(phaseCode) {
    const phase = this.phases.find((p) => p.code === phaseCode);

    if (!phase) {
      throw Boom.badRequest(`Phase with code "${phaseCode}" not found`);
    }

    return phase;
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

  validateComment({ phaseCode, stageCode, actionCode, action, comment }) {
    if (this.isMissingRequiredComment(action, comment)) {
      throw Boom.badRequest(
        `Phase "${phaseCode}", Stage "${stageCode}", Action "${actionCode}" requires a comment`,
      );
    }
  }

  isMissingRequiredComment(action, comment) {
    return action.comment?.type === "REQUIRED" && !comment?.trim();
  }

  static createMock(props) {
    return new Workflow({
      code: "workflow-code",
      pages: createPagesMock(),
      phases: [WorkflowPhase.createMock()],
      requiredRoles: new Permissions({
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      }),
      definitions: {
        key1: "value1",
      },
      ...props,
    });
  }
}
