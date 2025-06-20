import Joi from "joi";

export const emailSchema = Joi.string()
  .email()
  .example("firstname.lastname@defra.gov.uk");
