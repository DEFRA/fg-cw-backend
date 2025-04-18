import Joi from "joi";
import { TaskSection } from "./workflow.schema.js";

const GrantCaseEventIdentifiers = Joi.object({
  sbi: Joi.string().required(),
  frn: Joi.string().required(),
  crn: Joi.string().required(),
  defraId: Joi.string().required()
}).label("GrantCaseEventIdentifiers");

const GrantCaseEventAnswers = Joi.object({
  scheme: Joi.string().valid("SFI").required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
  hasCheckedLandIsUpToDate: Joi.boolean().required(),
  actionApplications: Joi.array()
    .items(
      Joi.object({
        parcelId: Joi.string().required(),
        sheetId: Joi.string().required(),
        code: Joi.string().required(),
        appliedFor: Joi.object({
          unit: Joi.string().valid("ha", "acres").required(),
          quantity: Joi.number().positive().required()
        }).required()
      })
    )
    .required()
}).label("GrantCaseEventAnswers");

const GrantCaseEvent = Joi.object({
  clientRef: Joi.string().required(),
  code: Joi.string().required(),
  createdAt: Joi.date().iso().required(),
  submittedAt: Joi.date().iso().required(),
  identifiers: GrantCaseEventIdentifiers.required(),
  answers: GrantCaseEventAnswers.required()
});

const CasePayload = Joi.alternatives()
  .try(GrantCaseEvent.optional())
  .required()
  .label("CasePayload");

const CaseData = Joi.object({
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
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
