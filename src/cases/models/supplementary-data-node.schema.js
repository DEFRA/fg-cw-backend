import Boom from "@hapi/boom";
import Joi from "joi";

export const supplementaryDataNodeSchema = Joi.string()
  .trim()
  .min(1)
  .pattern(/^[^.$\0]+$/)
  .invalid(...Object.getOwnPropertyNames(Object.prototype), "prototype")
  .required()
  .prefs({ convert: false });

export const assertIsSupplementaryDataNode = (targetNode) => {
  const { error } = supplementaryDataNodeSchema.validate(targetNode);
  if (error) {
    throw Boom.badRequest(
      `Invalid supplementary data target node: ${error.message}`,
    );
  }
};
