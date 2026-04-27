import Boom from "@hapi/boom";
import { Position } from "./position.js";
import { WorkflowActionComment } from "./workflow-action-comment.js";
import { WorkflowAction } from "./workflow-action.js";
import { WorkflowStageStatus } from "./workflow-stage-status.js";
import { WorkflowStage } from "./workflow-stage.js";
import { WorkflowTaskGroup } from "./workflow-task-group.js";
import { WorkflowTransition } from "./workflow-transition.js";

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

  static createMock(num = 1) {
    return new WorkflowPhase({
      code: "PHASE_" + num,
      name: "Phase " + num,
      stages: [
        WorkflowPhase.#createMockStage1(),
        WorkflowPhase.#createMockStage2(),
        WorkflowPhase.#createMockStage3(),
      ],
    });
  }

  static #createMockStage1() {
    return new WorkflowStage({
      code: "STAGE_1",
      name: "Stage 1",
      description: "Stage 1 description",
      statuses: [
        WorkflowPhase.#createMockStatus1WithTransitions(),
        WorkflowPhase.#createMockStatus2(),
      ],
      taskGroups: [WorkflowTaskGroup.createMock()],
    });
  }

  static #createMockStatus1WithTransitions() {
    return new WorkflowStageStatus({
      code: "STATUS_1",
      name: "Stage status 1",
      theme: "INFO",
      description: "Stage status 1 description",
      interactive: true,
      closes: false,
      transitions: [
        new WorkflowTransition({
          targetPosition: Position.from("PHASE_1:STAGE_1:STATUS_2"),
          checkTasks: true,
          action: new WorkflowAction({
            code: "ACTION_1",
            name: "Action 1",
            checkTasks: true,
            comment: new WorkflowActionComment({
              label: "Action label 1",
              helpText: "Action help text",
              mandatory: true,
            }),
          }),
        }),
        new WorkflowTransition({
          targetPosition: Position.from("PHASE_1:STAGE_2:STATUS_1"),
          checkTasks: true,
        }),
        new WorkflowTransition({
          targetPosition: Position.from("PHASE_2:STAGE_1:STATUS_1"),
          checkTasks: true,
        }),
      ],
    });
  }

  static #createMockStatus2() {
    return new WorkflowStageStatus({
      code: "STATUS_2",
      name: "Stage status 2",
      theme: "INFO",
      description: "Stage status 2 description",
      interactive: true,
      closes: false,
      transitions: [],
    });
  }

  static #createMockStage2() {
    return new WorkflowStage({
      code: "STAGE_2",
      name: "Stage 2",
      description: "Stage 2 description",
      statuses: [
        new WorkflowStageStatus({
          code: "STATUS_1",
          name: "Stage status 1",
          theme: "INFO",
          description: "Stage status 1 description",
          interactive: true,
          closes: false,
          transitions: [],
        }),
        new WorkflowStageStatus({
          code: "STATUS_3",
          name: "Stage status 3",
          theme: "INFO",
          description: "Stage status 3 description",
          interactive: true,
          closes: false,
          transitions: [],
        }),
      ],
      taskGroups: [],
    });
  }

  static #createMockStage3() {
    return new WorkflowStage({
      code: "STAGE_3",
      name: "Stage 3",
      description: "Stage 3 description",
      statuses: [
        new WorkflowStageStatus({
          code: "STATUS_3",
          name: "Stage status 3",
          theme: "INFO",
          description: "Stage status 3 description",
          interactive: true,
          closes: false,
          transitions: [],
        }),
      ],
      taskGroups: [],
    });
  }
}
