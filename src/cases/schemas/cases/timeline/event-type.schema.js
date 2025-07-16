import Joi from "joi";
export const timelineEventTypeSchema = Joi.string()
  .valid(
    "CASE_CREATED",
    "NOTE_ADDED",
    "CASE_ASSIGNED",
    "CASE_UNASSIGNED",
    "SUBMISSION",
    "TASK_COMPLETED",
  )
  .required();
