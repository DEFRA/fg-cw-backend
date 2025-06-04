import Joi from "joi";
import { UrlSafeId } from "./url-safe-id.schema.js";

const GrantCaseEventIdentifiers = Joi.object({
  sbi: Joi.string().required(),
  frn: Joi.string().required(),
  crn: Joi.string().required(),
  defraId: Joi.string().required()
}).label("GrantCaseEventIdentifiers");

const GrantCaseEventAnswers = Joi.object({
  agreementName: Joi.string().required(),
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

const CaseStage = Joi.object({
  id: UrlSafeId.required(),
  taskGroups: Joi.array()
    .items(
      Joi.object({
        id: UrlSafeId.required(),
        tasks: Joi.array()
          .items(
            Joi.object({
              id: UrlSafeId.required(),
              isComplete: Joi.boolean().required()
            })
          )
          .min(1)
          .required()
      })
    )
    .required()
}).label("CaseStage");

const CaseData = Joi.object({
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  status: Joi.string().valid("NEW", "IN PROGRESS", "COMPLETED").required(),
  dateReceived: Joi.date().iso().required(),
  targetDate: Joi.date().iso().allow(null).optional(),
  priority: Joi.string().valid("LOW", "MEDIUM", "HIGH").required(),
  assignedUser: Joi.string().allow(null).optional(),
  payload: CasePayload.required(),
  currentStage: UrlSafeId.required(),
  stages: Joi.array().items(CaseStage).required()
}).label("CaseData");

const Case = CaseData.keys({
  _id: Joi.object().required()
}).label("Case");

const NextStage = Joi.object({
  nextStage: Joi.string().required()
}).label("NextStage");

export const caseSchema = {
  CaseData,
  Case,
  GrantCaseEvent,
  NextStage
};
