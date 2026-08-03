import Joi from "joi";
import { validateProps } from "../../common/validation.js";
import { comment } from "../schemas/comment.schema.js";
import { requiredRolesSchema } from "../schemas/requiredRoles.schema.js";
import { Code, ValueOption } from "../schemas/task.schema.js";

export class WorkflowTask {
  constructor(props) {
    const value = validateProps(
      props,
      WorkflowTask.validationSchema,
      "WorkflowTask",
    );

    this.conditional = value.conditional;
    this.code = value.code;
    this.name = value.name;
    this.description = value.description;
    this.mandatory = value.mandatory;
    this.valueOptions = value.valueOptions;
    this.requiredRoles = value.requiredRoles;
    this.comment = value.comment;
  }

  getRequiredRoles() {
    return (
      this.requiredRoles ?? {
        allOf: [],
        anyOf: [],
      }
    );
  }
}

WorkflowTask.validationSchema = Joi.object({
  conditional: Joi.string().optional().allow(null),
  code: Code.required(),
  mandatory: Joi.boolean().required(),
  name: Joi.string().required(),
  description: Joi.alternatives()
    .try(Joi.string(), Joi.array(), Joi.valid(null))
    .required(),
  valueOptions: Joi.array().items(ValueOption).required(),
  comment: comment.optional().allow(null),
  requiredRoles: Joi.alternatives()
    .try(requiredRolesSchema, Joi.valid(null))
    .optional(),
})
  .custom((value, helpers) => {
    if (value.valueOptions && value.valueOptions.length > 0) {
      const hasCompletingOption = value.valueOptions.some(
        (option) => option.completes === true,
      );
      if (!hasCompletingOption) {
        return helpers.error("task.valueOptions.noCompletingOption");
      }
    }
    return value;
  })
  .messages({
    "task.valueOptions.noCompletingOption":
      "At least one status option must have completes set to true",
  })
  .label("Task");
