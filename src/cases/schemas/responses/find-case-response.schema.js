import Joi from "joi";
import { assignedUserSchema } from "../cases/assigned-user.schema.js";
import { statusSchema } from "../cases/stages/tasks/status.schema.js";
import { requiredRolesSchema } from "../requiredRoles.schema.js";
import { UrlSafeId } from "../url-safe-id.schema.js";

export const CaseStage = Joi.object({
  id: UrlSafeId.required(),
  taskGroups: Joi.array()
    .items(
      Joi.object({
        id: UrlSafeId.required(),
        tasks: Joi.array()
          .items(
            Joi.object({
              id: UrlSafeId.required(),
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

export const findCaseResponseSchema = Joi.object({
  _id: Joi.string().hex().length(24).required(),
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  status: Joi.string()
    .valid("NEW", "IN PROGRESS", "APPROVED", "COMPLETED")
    .required(),
  dateReceived: Joi.date().iso().required(),
  payload: Joi.object().required(),
  currentStage: UrlSafeId.required(),
  stages: Joi.array().items(CaseStage).required(),
  assignedUser: assignedUserSchema.allow(null),
  requiredRoles: requiredRolesSchema.required(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindCaseResponse");
