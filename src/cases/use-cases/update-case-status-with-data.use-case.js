import Boom from "@hapi/boom";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";

export const updateCaseStatusWithDataUseCase = async ({
  caseRef,
  workflowCode,
  newStatus,
  supplementaryData,
}) => {
  const kase = await findByCaseRefAndWorkflowCode(caseRef, workflowCode);

  if (!kase) {
    throw Boom.notFound(
      `Case with caseRef "${caseRef}" and workflowCode "${workflowCode}" not found`,
    );
  }

  if (supplementaryData?.targetNode === "agreements") {
    kase.addAgreementData({ agreementData: supplementaryData, newStatus });
    await update(kase);
  }

  return kase;
};
