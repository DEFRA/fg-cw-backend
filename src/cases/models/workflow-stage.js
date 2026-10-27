import Boom from "@hapi/boom";
import Joi from "joi";
import { validateProps } from "../../common/validation.js";
import { requiredRolesSchema } from "../schemas/requiredRoles.schema.js";
import { uniqueCodes } from "../schemas/unique-codes.schema.js";
import { WorkflowStageStatus } from "./workflow-stage-status.js";
import { WorkflowTaskGroup } from "./workflow-task-group.js";

export class WorkflowStage {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.requiredRoles = props.requiredRoles;
    this.description = props.description;
    this.statuses = props.statuses;
    this.taskGroups = props.taskGroups;
    this.beforeContent = props.beforeContent || [];
    this.afterContent = props.afterContent || [];
  }

  static fromDefinition(definition) {
    validateProps(
      definition,
      WorkflowStage.definitionSchema,
      `WorkflowStage "${definition?.code}"`,
    );

    return new WorkflowStage({
      ...definition,
      statuses: definition.statuses.map(WorkflowStageStatus.fromDefinition),
      taskGroups: definition.taskGroups.map(WorkflowTaskGroup.fromDefinition),
    });
  }

  findTaskGroup(taskGroupCode) {
    const taskGroup = this.taskGroups.find((s) => s.code === taskGroupCode);

    if (!taskGroup) {
      throw Boom.notFound(`TaskGroup with code "${taskGroupCode}" not found`);
    }

    return taskGroup;
  }

  getStatus(statusCode) {
    const status = this.statuses.find((s) => s.code === statusCode);

    if (!status) {
      throw Boom.notFound(
        `Stage with code ${this.code} has no status with code ${statusCode}`,
      );
    }

    return status;
  }

  getTransition(position, actionCode) {
    const status = this.getStatus(position.statusCode);
    return status.getTransition(actionCode);
  }

  getActionByCode(position, actionCode) {
    const actions = this.getActions(position);
    const action = actions.find((a) => a.code === actionCode);
    return action ?? null;
  }

  getActions(position) {
    const status = this.getStatus(position.statusCode);

    return status.getActions();
  }
}

WorkflowStage.definitionSchema = Joi.object({
  requiredRoles: requiredRolesSchema.allow(null),
  statuses: uniqueCodes.required(),
  taskGroups: uniqueCodes.required(),
}).unknown();
