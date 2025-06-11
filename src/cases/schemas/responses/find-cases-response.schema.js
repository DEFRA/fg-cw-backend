import Joi from "joi";
import { findCaseResponseSchema } from "./find-case-response.schema.js";

export const findCasesResponseSchema = Joi.array()
  .items(findCaseResponseSchema)
  .required()
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindCasesResponse");
