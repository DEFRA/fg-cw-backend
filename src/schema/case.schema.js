import Joi from "joi";
import { TaskSection } from "./workflow.schema.js";

const DataItem = Joi.object({
  id: Joi.string(),
  label: Joi.string(),
  valueString: Joi.string().optional(),
  valueBoolean: Joi.boolean().optional(),
  valueDate: Joi.date().iso().optional(),
  valueNumber: Joi.number().optional(),
  valueType: Joi.string()
    .valid("string", "boolean", "date", "number")
    .optional()
}).label("DataItem");

const GrantCaseEvent = Joi.object({
  id: Joi.string().required(),
  code: Joi.string(),
  clientRef: Joi.string(),
  caseName: Joi.string(),
  businessName: Joi.string(),
  createdAt: Joi.date().iso().required(),
  submittedAt: Joi.date().iso().required(),
  data: Joi.array().items(DataItem)
}).label("GrantCaseEvent");

const CasePayload = Joi.alternatives()
  .try(GrantCaseEvent.optional())
  .required()
  .label("CasePayload");

const CaseData = Joi.object({
  id: Joi.string().required(),
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  caseName: Joi.string().required(),
  businessName: Joi.string().required(),
  status: Joi.string().valid("NEW", "IN PROGRESS", "COMPLETED").required(),
  dateReceived: Joi.date().iso().required(),
  targetDate: Joi.date().iso().allow(null).optional(),
  priority: Joi.string().valid("LOW", "MEDIUM", "HIGH").required(),
  assignedUser: Joi.string().allow(null).optional(),
  taskSections: Joi.array().items(TaskSection).required(),
  payload: CasePayload.required()
}).label("CaseData");

const Case = CaseData.keys({
  _id: Joi.object().required()
}).label("Case");

export const caseSchema = {
  CaseData,
  Case,
  GrantCaseEvent
};
