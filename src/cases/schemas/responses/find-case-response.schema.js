import Joi from "joi";
import { CaseStage } from "../case.schema.js";
import { UrlSafeId } from "../url-safe-id.schema.js";

export const findCaseResponseSchema = Joi.object({
  _id: Joi.string().hex().length(24).required(),
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  status: Joi.string().valid("NEW", "IN PROGRESS", "COMPLETED").required(),
  dateReceived: Joi.date().iso().required(),
  payload: Joi.object().required(),
  currentStage: UrlSafeId.required(),
  stages: Joi.array().items(CaseStage).required(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindCaseResponse");
