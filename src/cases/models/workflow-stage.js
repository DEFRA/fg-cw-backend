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

  getActionByCode(actionCode) {
    for (const status of this.statuses) {
      const action = status.getActions().find((a) => a.code === actionCode);

      if (action) {
        return action;
      }
    }
    return null;
  }

  getActions(position) {
    const status = this.getStatus(position.statusCode);

    return status.getActions();
  }
}
