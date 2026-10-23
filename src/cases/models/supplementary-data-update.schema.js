import Joi from "joi";
import { supplementaryDataNodeSchema } from "./supplementary-data-node.schema.js";

const reference = Joi.string().trim().min(1).required();
const identity = Joi.alternatives(Joi.string().min(1), Joi.number()).required();
const objectIdentity = Joi.alternatives(
  Joi.string()
    .min(1)
    .pattern(/^[^\0]+$/),
  Joi.number(),
).required();
const validateMergeKey = (instruction, helpers) => {
  if (!Object.hasOwn(instruction.data, instruction.key)) {
    return helpers.error("any.invalid");
  }
  const identitySchema =
    instruction.dataType === "OBJECT" ? objectIdentity : identity;
  if (identitySchema.validate(instruction.data[instruction.key]).error) {
    return helpers.error("any.invalid");
  }
  return instruction;
};

export const supplementaryDataUpdateSchema = Joi.object({
  targetNode: supplementaryDataNodeSchema,
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
