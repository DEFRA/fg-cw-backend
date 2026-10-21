import Boom from "@hapi/boom";
import {
  findByCaseRefAndWorkflowCode,
  updateClaimSupplementaryData,
} from "../repositories/case.repository.js";
import { claimSubmittedDataSchema } from "../models/claim-submitted-data.schema.js";

const validatedSubmissionData = (message) => {
  const { error, value } = claimSubmittedDataSchema.validate(
    message.event?.data,
  );
  if (error) {
    throw Boom.badData(`Invalid submitted claim event: ${error.message}`);
  }
  return value;
};

export const handleClaimSubmittedUseCase = async (message) => {
  const { caseRef, workflowCode, claims } = validatedSubmissionData(message);
  const kase = await findByCaseRefAndWorkflowCode(caseRef, workflowCode);
  if (!kase) {
    throw Boom.notFound(
      `Case with caseRef "${caseRef}" and workflowCode "${workflowCode}" not found`,
    );
  }
  for (const claim of claims) {
    kase.updateSupplementaryData({
      targetNode: "claims",
      dataType: "ARRAY",
      key: "gasClaimId",
      data: claim,
    });
  }
  await updateClaimSupplementaryData(kase);
};
