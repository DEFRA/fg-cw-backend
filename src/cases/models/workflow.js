import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { createPagesMock } from "./create-pages-mock.js";
import { Permissions } from "./permissions.js";
import { Position } from "./position.js";
import { WorkflowPhase } from "./workflow-phase.js";

export class Workflow {
  constructor(props) {
    this._id = props._id || new ObjectId().toHexString();
    this.code = props.code;
    this.pages = props.pages;
    this.phases = props.phases;
    this.requiredRoles = props.requiredRoles;
    this.definitions = props.definitions;
    this.externalActions = props.externalActions;
  }

  findTask({ phaseCode, stageCode, taskGroupCode, taskCode }) {
    const task = this.findPhase(phaseCode)
      .findStage(stageCode)
      .findTaskGroup(taskGroupCode)
      .findTask(taskCode);

    return task;
  }

  validateStageActionComment({ position, actionCode, comment }) {
    const action = this.getStage(position).getActionByCode(actionCode);

    this.validateComment({
      phaseCode: position.phaseCode,
      stageCode: position.stageCode,
      actionCode,
      action,
      comment,
    });

    return true;
  }

  findPhase(phaseCode) {
    const phase = this.phases.find((p) => p.code === phaseCode);

    if (!phase) {
      throw Boom.badRequest(`Phase with code "${phaseCode}" not found`);
    }

    return phase;
  }

  getStage(position) {
    return this.findPhase(position.phaseCode).findStage(position.stageCode);
  }

  getStatus(position) {
    return this.getStage(position).getStatus(position.statusCode);
  }

  validateComment({ phaseCode, stageCode, actionCode, action, comment }) {
    if (this.isMissingRequiredComment(action, comment)) {
      throw Boom.badRequest(
        `Phase "${phaseCode}", Stage "${stageCode}", Action "${actionCode}" requires a comment`,
      );
    }
  }

  isMissingRequiredComment(action, comment) {
    return action.comment?.mandatory && !comment?.trim();
  }

  getInitialPosition() {
    const [phase] = this.phases;
    const [stage] = phase.stages;
    const [status] = stage.statuses;

    return new Position({
      phaseCode: phase.code,
      stageCode: stage.code,
      statusCode: status.code,
    });
  }

  getNextPosition(position, actionCode) {
    const stage = this.getStage(position);
    const transition = stage.getTransition(position, actionCode);

    if (!transition) {
      throw new Error(
        `Workflow ${this.code} does not support transition from ${position} with action ${actionCode}`,
      );
    }

    return transition.targetPosition;
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
      externalActions: [
        {
          code: "RERUN_RULES",
          name: "Rerun Rules",
          description: "Rerun the business rules validation",
          endpoint: "landGrantsRulesRerun",
          target: {
            position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
            node: "landGrantsRulesRun",
            nodeType: "array",
            place: "append",
          },
        },
      ],
      ...props,
    });
  }
}
