import Boom from "@hapi/boom";

export class CaseTaskGroup {
  constructor(props) {
    this.code = props.code;
    this.tasks = props.tasks;
  }

  findTask(taskCode) {
    const task = this.tasks.find((s) => s.code === taskCode);

    if (!task) {
      throw Boom.notFound(`Cannot find Task with code ${taskCode}`);
    }

    return task;
  }

  getUserIds() {
    return this.tasks.flatMap((t) => t.getUserIds());
  }

  isComplete(workflowTaskGroup) {
    for (const workflowTask of workflowTaskGroup.tasks) {
      const caseTask = this.findTask(workflowTask.code);

      if (!caseTask.isComplete(workflowTask)) {
        return false;
      }
    }

    return true;
  }
}
