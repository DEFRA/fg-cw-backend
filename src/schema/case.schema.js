import Joi from "joi";
import { TaskSection } from "./workflow.schema.js";

const DataItem = Joi.object({
  id: Joi.string(),
  label: Joi.string(),
  data: Joi.alternatives().try(Joi.string(), Joi.boolean(), Joi.allow(null))
}).label("DataItem");

const CasePayload = Joi.object({
  grantApplication: Joi.object({
    grantCode: Joi.string(),
    clientRef: Joi.string(),
    caseName: Joi.string(),
    businessName: Joi.string(),
    createdAt: Joi.string(),
    submittedAt: Joi.string(),
    data: Joi.array().items(DataItem)
  })
}).label("CasePayload");

const CaseData = Joi.object({
  id: Joi.string().required(),
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  caseName: Joi.string().required(),
  businessName: Joi.string().required(),
  status: Joi.string().valid("NEW", "IN PROGRESS", "COMPLETED").required(),
  dateReceived: Joi.date().iso().required(),
  targetDate: Joi.date().iso().required(),
  priority: Joi.string().valid("LOW", "MEDIUM", "HIGH").required(),
  assignedUser: Joi.string().required(),
  taskSections: Joi.array().items(TaskSection).required(),
  payload: CasePayload.required()
}).label("CaseData");

const Case = CaseData.keys({
  _id: Joi.object().required()
}).label("Case");

export const caseSchema = {
  CaseData,
  Case
};
