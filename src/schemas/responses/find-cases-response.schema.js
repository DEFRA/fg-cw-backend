import Joi from "joi";
import { CasePayload, CaseStage } from "../case.schema.js";
import { UrlSafeId } from "../url-safe-id.schema.js";

export const findCaseResponseSchema = Joi.object({
  _id: Joi.object().required(),
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  status: Joi.string().valid("NEW", "IN PROGRESS", "COMPLETED").required(),
  dateReceived: Joi.date().iso().required(),
  priority: Joi.string().valid("LOW", "MEDIUM", "HIGH").required(),
  payload: CasePayload.required(),
  currentStage: UrlSafeId.required(),
  stages: Joi.array().items(CaseStage).required()
})
  .options({
    presence: "required",
    stripUnknown: true
  })
  .label("FindCaseResponse");
