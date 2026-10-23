import Joi from "joi";

// The runtime finds an item by the first one with its code, so a later one with
// the same code could never be reached.
export const uniqueCodes = Joi.array()
  .items(Joi.object({ code: Joi.string().required() }).unknown())
  .unique("code")
  .messages({ "array.unique": '{{#label}} repeats code "{{#value.code}}"' });
