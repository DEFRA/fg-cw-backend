import Joi from "joi";
import { typeSchema } from "../../common/schemas/type.schema.js";
import { requiredRolesSchema } from "./requiredRoles.schema.js";
import { Stage } from "./task.schema.js";

const Field = Joi.object({
  ref: Joi.string().required(),
  type: typeSchema,
  label: Joi.string().required(),
  format: Joi.string(),
});

const Section = Joi.object({
  title: Joi.string().required(),
  type: Joi.string().valid("object", "array").required(),
  component: Joi.string().valid("list", "table").required(),
  fields: Joi.array().items(Field).min(1).required(),
});

const Tab = Joi.object({
  title: Joi.string().required(),
  sections: Joi.array().items(Section).min(1).required(),
});

const SummaryField = Joi.object({
  label: Joi.string().required(),
  ref: Joi.string().required(),
  type: Joi.string().valid("string", "number", "boolean", "date").required(),
});

const Banner = Joi.object({
  summary: Joi.object().pattern(Joi.string(), SummaryField).min(1).required(),
});

const CaseDetails = Joi.object({
  banner: Banner.required(),
  tabs: Joi.object().pattern(Joi.string(), Tab).required(),
});

const Cases = Joi.object({
  details: CaseDetails.required(),
});

const Pages = Joi.object({
  cases: Cases.required(),
});

const WorkflowData = Joi.object({
  code: Joi.string()
    .pattern(/^[a-zA-Z0-9-]+$/)
    .required(),
  pages: Pages.required(),
  stages: Joi.array().items(Stage).min(2).required(),
  requiredRoles: requiredRolesSchema.required(),
});

const Workflow = WorkflowData.keys({
  _id: Joi.string().hex().length(24).required(),
}).label("Workflow");

export const workflowSchema = {
  WorkflowData,
  Workflow,
};
