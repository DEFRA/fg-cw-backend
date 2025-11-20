import Boom from "@hapi/boom";

export class WorkflowStage {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.statuses = props.statuses;
    this.taskGroups = props.taskGroups;
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
