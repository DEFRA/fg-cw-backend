import Joi from "joi";

export const eventStatusResponseSchema = Joi.object({
  status: Joi.string()
    .required()
    .example("RESUBMITTED")
    .description(
      "PUBLISHED|PROCESSING|FAILED|RESUBMITTED|COMPLETED|DEAD_LETTER|PURGED",
    ),
  // Reset by a redrive, so it counts the attempts since the last one.
  completionAttempts: Joi.number().integer().min(0).required(),
  maxAttempts: Joi.number().integer().required(),
}).label("EventStatus");
