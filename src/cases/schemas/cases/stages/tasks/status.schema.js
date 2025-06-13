import Joi from "joi";

export const statusSchema = Joi.string().valid(
  "pending",
  "in_progress",
  "complete",
);
