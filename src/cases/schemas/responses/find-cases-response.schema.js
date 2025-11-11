import Joi from "joi";
import { assignedUserSchema } from "../cases/assigned-user.schema.js";

const findCasesResultSchema = Joi.object({
  _id: Joi.string().hex().length(24).required(),
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  currentStatus: Joi.string()
    .valid(
      "NEW",
      "IN PROGRESS",
      "APPROVED",
      "COMPLETED",
      "REVIEW",
      "OFFER_WITHDRAWN",
      "OFFERED",
      "OFFER_ACCEPTED",
    )
    .required(),
  dateReceived: Joi.date().iso().required(),
  payload: Joi.object().required(),
  assignedUser: assignedUserSchema.allow(null),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindCasesItemResponse");

export const findCasesResponseSchema = Joi.array()
  .items(findCasesResultSchema)
  .required()
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindCasesResponse");
