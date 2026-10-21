import Joi from "joi";

const reference = Joi.string().trim().min(1).required();
const identity = Joi.alternatives(Joi.string().min(1), Joi.number()).required();
const validateMergeKey = (instruction, helpers) => {
  if (!Object.hasOwn(instruction.data, instruction.key)) {
    return helpers.error("any.invalid");
  }
  if (identity.validate(instruction.data[instruction.key]).error) {
    return helpers.error("any.invalid");
  }
  return instruction;
};

export const supplementaryDataUpdateSchema = Joi.object({
  targetNode: reference
    .pattern(/^[^.$\0]+$/)
    .invalid(...Object.getOwnPropertyNames(Object.prototype), "prototype"),
  dataType: Joi.string().valid("ARRAY", "OBJECT").required(),
  key: reference,
  data: Joi.object().unknown(true).required(),
})
  .custom(validateMergeKey)
  .required()
  .unknown(false);

export const updateCaseSupplementaryDataSchema = Joi.object({
  caseRef: reference,
  workflowCode: reference,
  supplementaryData: supplementaryDataUpdateSchema,
})
  .required()
  .unknown(false)
  .prefs({ convert: false, abortEarly: false });
