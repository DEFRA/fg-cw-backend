import { RequiredRolesDocument } from "./required-roles-document.js";
import { StatusOptionDocument } from "./status-option-document.js";
import { TaskDocument } from "./task-document.js";

export class TaskGroupDocument {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.description = props.description;
    this.tasks = props.tasks.map((task) => new TaskDocument(task));
  }

  static createMock() {
    return new TaskGroupDocument({
      code: "TASK_GROUP_1",
      name: "Task group 1",
      description: "Task group description",
      tasks: [
        new TaskDocument({
          code: "TASK_1",
          name: "Task 1",
          description: "Task 1 description",
          mandatory: true,
          statusOptions: [
            new StatusOptionDocument({
              code: "STATUS_OPTION_1",
              name: "Status option 1",
              theme: "SUCCESS",
              completes: true,
            }),
          ],
          comment: null,
          requiredRoles: new RequiredRolesDocument({
            allOf: ["ROLE_1"],
            anyOf: ["ROLE_2"],
          }),
        }),
      ],
    });
  }
}
