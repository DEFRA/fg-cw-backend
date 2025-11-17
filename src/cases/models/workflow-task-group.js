import Boom from "@hapi/boom";
import { Permissions } from "./permissions.js";
import { WorkflowTaskStatusOption } from "./workflow-task-status-option.js";
import { WorkflowTask } from "./workflow-task.js";

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

  static createMock() {
    return new WorkflowTaskGroup({
      code: "TASK_GROUP_1",
      name: "Task group 1",
      description: "Task group description",
      tasks: [
        new WorkflowTask({
          code: "TASK_1",
          name: "Task 1",
          description: "Task 1 description",
          mandatory: true,
          statusOptions: [
            new WorkflowTaskStatusOption({
              code: "STATUS_OPTION_1",
              name: "Status option 1",
              completes: true,
            }),
          ],
          comment: null,
          requiredRoles: new Permissions({
            allOf: ["ROLE_1"],
            anyOf: ["ROLE_2"],
          }),
        }),
      ],
    });
  }
}
