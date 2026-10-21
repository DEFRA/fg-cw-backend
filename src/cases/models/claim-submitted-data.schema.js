import Joi from "joi";

const reference = Joi.string().trim().min(1).required();
const submittedClaim = Joi.object({
  gasClaimId: reference,
  clientClaimRef: reference,
  claimCode: reference,
  claimAmountPence: Joi.number().integer().min(0).required(),
  sbi: reference,
  status: Joi.string().valid("SUBMITTED").required(),
  submittedAt: Joi.string().isoDate().required(),
}).unknown(false);

export const claimSubmittedDataSchema = Joi.object({
  caseRef: reference,
  workflowCode: reference,
  claims: Joi.array()
    .items(submittedClaim)
    .min(1)
    .unique("gasClaimId")
    .required(),
})
  .required()
  .unknown(false)
  .prefs({ convert: false, abortEarly: false });
