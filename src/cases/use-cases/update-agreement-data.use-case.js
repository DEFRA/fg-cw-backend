import Boom from "@hapi/boom";
import { Agreement } from "../models/agreement.js";
import {
  findByCaseRefAndWorkflowCode,
  update,
} from "../repositories/case.repository.js";

export const updateAgreementDataUseCase = async ({
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

  kase.updateStatus(newStatus, null);

  const { agreementRef, agreementStatus, createdAt } = supplementaryData.data;

  const agreement = kase.getAgreement(agreementRef);

  if (agreement) {
    agreement.addHistoryEntry({ agreementStatus, createdAt });
  } else {
    const newAgreement = Agreement.new({
      agreementRef,
      agreementStatus,
      date: createdAt,
    });
    kase.addAgreement(newAgreement);
  }

  await update(kase);

  return kase;
};
