import Joi from "joi";
import { assignedUserSchema } from "./cases/assigned-user.schema.js";
import { statusSchema } from "./cases/stages/tasks/status.schema.js";
import { timelineSchema } from "./cases/timeline/timeline.schema.js";
import { UrlSafeId } from "./url-safe-id.schema.js";

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
            }),
          )
          .min(1)
          .required(),
      }),
    )
    .required(),
}).label("CaseStage");

const CaseData = Joi.object({
  workflowCode: Joi.string().required(),
  caseRef: Joi.string().required(),
  status: Joi.string().valid("NEW", "IN PROGRESS", "COMPLETED").required(),
  dateReceived: Joi.string().isoDate().required(),
  payload: Joi.object().required(),
  currentStage: UrlSafeId.required(),
  stages: Joi.array().items(CaseStage).required(),
  timeline: Joi.array().items(timelineSchema).required(),
  assignedUser: assignedUserSchema.allow(null),
}).label("CaseData");

const Case = CaseData.keys({
  _id: Joi.string().hex().length(24).required(),
}).label("Case");

const NextStage = Joi.object({
  nextStage: Joi.string().required(),
}).label("NextStage");

export const caseSchema = {
  CaseData,
  Case,
  NextStage,
};
