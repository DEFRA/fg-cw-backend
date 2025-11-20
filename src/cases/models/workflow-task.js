import Joi from "joi";
import { validateProps } from "../../common/validation.js";
import { comment } from "../schemas/comment.schema.js";
import { requiredRolesSchema } from "../schemas/requiredRoles.schema.js";
import { Code } from "../schemas/task.schema.js";

export class WorkflowTask {
  constructor(props) {
    const value = validateProps(
      props,
      WorkflowTask.validationSchema,
      "WorkflowTask",
    );

    this.code = value.code;
    this.name = value.name;
    this.description = value.description;
    this.mandatory = value.mandatory;
    this.statusOptions = value.statusOptions;
    this.requiredRoles = value.requiredRoles;
    this.comment = value.comment;
  }
}

WorkflowTask.validationSchema = Joi.object({
  code: Code.required(),
  mandatory: Joi.boolean().required(),
  name: Joi.string().required(),
  description: Joi.alternatives()
    .try(Joi.string(), Joi.array(), Joi.valid(null))
    .required(),
  statusOptions: Joi.array()
    .items(
      Joi.object({
        code: Joi.string().required(),
        name: Joi.string().required(),
        completes: Joi.boolean().required(),
      }).label("StatusOption"),
    )
    .required(),
  comment: comment.optional().allow(null),
  requiredRoles: Joi.alternatives()
    .try(requiredRolesSchema, Joi.valid(null))
    .optional(),
})
  .custom((value, helpers) => {
    if (value.statusOptions && value.statusOptions.length > 0) {
      const hasCompletingOption = value.statusOptions.some(
        (option) => option.completes === true,
      );
      if (!hasCompletingOption) {
        return helpers.error("task.statusOptions.noCompletingOption");
      }
    }
    return value;
  })
  .messages({
    "task.statusOptions.noCompletingOption":
      "At least one status option must have completes set to true",
  })
  .label("Task");
