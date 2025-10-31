import Boom from "@hapi/boom";

export class CaseStage {
  constructor(props) {
    this.code = props.code;
    this.taskGroups = props.taskGroups;
    this.outcome = props.outcome;
  }

  findTaskGroup(taskGroupCode) {
    const taskGroup = this.taskGroups.find((s) => s.code === taskGroupCode);

    if (!taskGroup) {
      throw Boom.notFound(`Cannot find TaskGroup with code ${taskGroupCode}`);
    }

    return taskGroup;
  }

  getUserIds() {
    return this.taskGroups.flatMap((tg) => tg.getUserIds());
  }
}
