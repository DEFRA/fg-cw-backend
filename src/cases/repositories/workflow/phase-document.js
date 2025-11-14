import { Position } from "../../models/position.js";
import { ActionDocument } from "./action-document.js";
import { CommentDocument } from "./comment-document.js";
import { StageDocument } from "./stage-document.js";
import { StatusDocument } from "./status-document.js";
import { TaskGroupDocument } from "./task-group-document.js";
import { TransitionDocument } from "./transition-document.js";

export class PhaseDocument {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.stages = props.stages.map((stage) => new StageDocument(stage));
  }

  static createMock() {
    return new PhaseDocument({
      code: "PHASE_1",
      name: "Phase 1",
      stages: [
        new StageDocument({
          code: "STAGE_1",
          name: "Stage 1",
          description: "Stage 1 description",
          statuses: [
            new StatusDocument({
              code: "STATUS_1",
              name: "Stage status 1",
              description: "Stage status 1 description",
              transitions: [
                new TransitionDocument({
                  targetPosition: Position.from("PHASE_1:STAGE_1:STATUS_2"),
                  action: new ActionDocument({
                    code: "ACTION_1",
                    name: "Action 1",
                    checkTasks: true,
                    comment: new CommentDocument({
                      label: "Action label 1",
                      helpText: "Action help text",
                      mandatory: true,
                    }),
                  }),
                }),
              ],
            }),
            new StatusDocument({
              code: "STATUS_2",
              name: "Stage status 2",
              description: "Stage status 2 description",
              transitions: [],
            }),
          ],
          taskGroups: [TaskGroupDocument.createMock()],
        }),
        new StageDocument({
          code: "STAGE_2",
          name: "Stage 2",
          description: "Stage 2 description",
          statuses: [],
          taskGroups: [],
        }),
        new StageDocument({
          code: "STAGE_3",
          name: "Stage 3",
          description: "Stage 3 description",
          statuses: [],
          taskGroups: [],
        }),
      ],
    });
  }
}
