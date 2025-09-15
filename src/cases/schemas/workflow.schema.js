import Joi from "joi";
import { typeSchema } from "../../common/schemas/type.schema.js";
import { requiredRolesSchema } from "./requiredRoles.schema.js";
import { Stage } from "./task.schema.js";

const Field = Joi.object({
  type: typeSchema.optional(),
  label: Joi.string().optional(),
  format: Joi.string().optional(),
  id: Joi.string().optional(),
  component: Joi.string().optional(),
  elements: Joi.array().items(Joi.object().unknown(true)).optional(),
  text: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  href: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  target: Joi.string().optional(),
  rel: Joi.string().optional(),
  classes: Joi.string().optional(),
  buttonText: Joi.string().optional(),
  feedbackText: Joi.string().optional(),
  classesMap: Joi.object().optional(),
}).unknown(true);

const Section = Joi.object({
  id: Joi.string().optional(),
  title: Joi.string().optional(),
  type: Joi.string().valid("object", "array").optional(),
  component: Joi.string().optional(),
  fields: Joi.array().items(Field).optional(),
  level: Joi.number().optional(),
  classes: Joi.string().optional(),
  rowsRef: Joi.string().optional(),
  firstCellIsHeader: Joi.boolean().optional(),
  text: Joi.alternatives().try(Joi.string(), Joi.object()).optional(),
  label: Joi.object().optional(),
}).unknown(true);

const Tab = Joi.object({
  title: Joi.string().optional(),
  renderIf: Joi.string().optional(),
  sections: Joi.array().items(Section).min(1).required(),
}).unknown(true);

const TitleField = Joi.object({
  text: Joi.string().allow("").optional(),
  type: Joi.string().required(),
});

const SummaryField = Joi.object({
  label: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().valid("string", "number", "boolean", "date").required(),
  format: Joi.string().optional(),
});

export const bannerSchema = Joi.object({
  title: TitleField.optional(),
  summary: Joi.object().pattern(Joi.string(), SummaryField).optional(),
}).unknown(true);

const CaseDetails = Joi.object({
  banner: bannerSchema.required(),
  tabLinks: Joi.array().optional(),
  tabs: Joi.object().pattern(Joi.string(), Tab).unknown(true).required(),
}).unknown(true);

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
  definitions: Joi.object().optional(),
}).unknown(true);

const Workflow = WorkflowData.keys({
  _id: Joi.string().hex().length(24).required(),
}).label("Workflow");

export const workflowSchema = {
  WorkflowData,
  Workflow,
};
