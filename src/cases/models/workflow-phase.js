import Boom from "@hapi/boom";
import { Permissions } from "./permissions.js";
import { WorkflowActionComment } from "./workflow-action-comment.js";
import { WorkflowAction } from "./workflow-action.js";
import { WorkflowStageStatus } from "./workflow-stage-status.js";
import { WorkflowStage } from "./workflow-stage.js";
import { WorkflowTaskGroup } from "./workflow-task-group.js";
import { WorkflowTaskStatusOption } from "./workflow-task-status-option.js";
import { WorkflowTask } from "./workflow-task.js";

export class WorkflowPhase {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.stages = props.stages;
  }

  findStage(stageCode) {
    const stage = this.stages.find((s) => s.code === stageCode);

    if (!stage) {
      throw Boom.notFound(`Stage with code "${stageCode}" not found`);
    }

    return stage;
  }

  static createMock() {
    return new WorkflowPhase({
      code: "phase-1",
      name: "Phase 1",
      stages: [
        new WorkflowStage({
          code: "stage-1",
          name: "Stage 1",
          description: "Stage 1 description",
          statuses: [
            new WorkflowStageStatus({
              code: "stage-status-1",
              name: "Stage status 1",
              description: "Stage status 1 description",
            }),
          ],
          taskGroups: [
            new WorkflowTaskGroup({
              code: "task-group-1",
              name: "Task group 1",
              description: "Task group description",
              tasks: [
                new WorkflowTask({
                  code: "task-1",
                  name: "Task 1",
                  type: "boolean",
                  description: "Task 1 description",
                  statusOptions: [
                    new WorkflowTaskStatusOption({
                      code: "status-option-1",
                      name: "Status option 1",
                      completes: false,
                    }),
                  ],
                  requiredRoles: new Permissions({
                    allOf: ["ROLE_1"],
                    anyOf: ["ROLE_2"],
                  }),
                }),
              ],
            }),
          ],
          actions: [
            new WorkflowAction({
              code: "action-1",
              name: "Action 1",
              comment: new WorkflowActionComment({
                type: "OPTIONAL",
                label: "Action label 1",
                helpText: "Action help text",
              }),
            }),
          ],
        }),
        new WorkflowStage({
          code: "stage-2",
          name: "Stage 2",
          description: "Stage 2 description",
          statuses: [],
          taskGroups: [],
          actions: [],
        }),
        new WorkflowStage({
          code: "stage-3",
          name: "Stage 3",
          description: "Stage 3 description",
          statuses: [],
          taskGroups: [],
          actions: [],
        }),
      ],
    });
  }
}
