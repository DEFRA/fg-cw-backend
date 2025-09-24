import Joi from "joi";
import { requiredRolesSchema } from "./requiredRoles.schema.js";
import { Stage } from "./task.schema.js";

export const componentSchema = Joi.object({
  id: Joi.string().optional(),
  component: Joi.string().optional(),
})
  .unknown()
  .label("Component");

export const bannerSchema = Joi.object({
  title: Joi.object({
    text: Joi.string().allow("").optional(),
    type: Joi.string().required(),
  }),
  summary: Joi.object()
    .pattern(
      Joi.string(),
      Joi.object({
        label: Joi.string().required(),
        text: Joi.string().allow("").optional(),
        type: Joi.string()
          .valid("string", "number", "boolean", "date")
          .required(),
        format: Joi.string().optional(),
      }),
    )
    .optional(),
}).unknown(true);

const caseSchema = Joi.object({
  banner: bannerSchema.required(),
  tabLinks: Joi.array().optional(),
  tabs: Joi.object()
    .pattern(
      Joi.string(),
      Joi.object({
        title: Joi.string().optional(),
        renderIf: Joi.string().optional(),
        link: Joi.object().optional(),
        content: Joi.array().items(componentSchema).min(1).required(),
      }).unknown(true),
    )
    .unknown(true)
    .required(),
}).unknown(true);

const WorkflowData = Joi.object({
  code: Joi.string()
    .pattern(/^[a-zA-Z0-9-]+$/)
    .required(),
  pages: Joi.object({
    cases: Joi.object({
      details: caseSchema.required(),
    }),
  }),
  stages: Joi.array().items(Stage).min(2).required(),
  requiredRoles: requiredRolesSchema.required(),
  definitions: Joi.object().optional(),
}).unknown(true);

const Workflow = WorkflowData.keys({
  _id: Joi.string().hex().length(24).required(),
}).label("Workflow");

export const workflowSchema = {
  WorkflowData,
  Workflow,
};
