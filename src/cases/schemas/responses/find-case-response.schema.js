import Joi from "joi";
import { assignedUserSchema } from "../cases/assigned-user.schema.js";
import { statusSchema } from "../cases/stages/tasks/status.schema.js";
import { requiredRolesSchema } from "../requiredRoles.schema.js";
import { UrlSafeId } from "../url-safe-id.schema.js";

export const CaseStage = Joi.object({
  code: UrlSafeId.required(),
  name: Joi.string().required(),
  description: Joi.string().required(),
  taskGroups: Joi.array()
    .items(
      Joi.object({
        code: UrlSafeId.required(),
        tasks: Joi.array()
          .items(
            Joi.object({
              code: UrlSafeId.required(),
              status: statusSchema.required(),
              commentRef: UrlSafeId.allow(null).optional(),
            }),
          )
          .min(1)
          .required(),
      }),
    )
    .required(),
  outcome: Joi.object({
    actionId: UrlSafeId.required(),
    comment: Joi.string().optional(),
    commentRef: Joi.string().optional(),
  })
    .optional()
    .allow(null),
}).label("CaseStage");

export const agreementSchema = Joi.object({
  agreementRef: Joi.string().pattern(/^[a-zA-Z0-9-]+$/),
  agreementStatus: Joi.string().pattern(/^[A-Z_]+$/),
  createdAt: Joi.date().iso(),
}).label("Agreement");

export const findCaseResponseSchema = Joi.object({
  _id: Joi.string().hex().length(24).required(),
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  status: Joi.string()
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
  currentStage: UrlSafeId.required(),
  stages: Joi.array().items(CaseStage).required(),
  assignedUser: assignedUserSchema.allow(null),
  requiredRoles: requiredRolesSchema.required(),
  supplementaryData: Joi.object(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindCaseResponse");
