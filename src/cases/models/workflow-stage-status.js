import Joi from "joi";
import { validateProps } from "../../common/validation.js";
import { Position } from "./position.js";
import { WorkflowTransition } from "./workflow-transition.js";

export class WorkflowStageStatus {
  constructor(props) {
    this.code = props.code;
    this.name = props.name;
    this.theme = props.theme;
    this.description = props.description;
    this.interactive = props.interactive;
    this.hideTaskGroups = props.hideTaskGroups;
    this.transitions = props.transitions;
    this.closes = props.closes;
  }

  static fromDefinition(definition) {
    validateProps(
      definition,
      WorkflowStageStatus.definitionSchema,
      `WorkflowStageStatus "${definition?.code}"`,
    );

    return new WorkflowStageStatus({
      ...definition,
      transitions: definition.transitions.map(
        (transition) =>
          new WorkflowTransition({
            ...transition,
            targetPosition: Position.from(transition.targetPosition),
          }),
      ),
    });
  }

  getActions() {
    return this.transitions.map((t) => t.action).filter(Boolean);
  }

  getTransition(actionCode) {
    return this.transitions.find((t) => t.action?.code === actionCode);
  }
}

// A case moves by the first transition with the chosen action code, so a later
// one with the same code could never be taken.
WorkflowStageStatus.definitionSchema = Joi.object({
  transitions: Joi.array()
    .items(
      Joi.object({
        action: Joi.object({ code: Joi.string().required() })
          .unknown()
          .allow(null),
      }).unknown(),
    )
    .unique("action.code", { ignoreUndefined: true })
    .messages({
      "array.unique": '{{#label}} repeats action code "{{#value.action.code}}"',
    })
    .required(),
}).unknown();
