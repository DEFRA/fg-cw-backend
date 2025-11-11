import Boom from "@hapi/boom";

export class WorkflowTaskGroup {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.tasks = props.tasks;
  }

  findTask(taskCode) {
    const task = this.tasks.find((s) => s.code === taskCode);

    if (!task) {
      throw Boom.notFound(`Task with code "${taskCode}" not found`);
    }

    return task;
  }
}
