import Boom from "@hapi/boom";
import { findByCaseRef, update } from "../repositories/case.repository.js";

export const addAgreementToCaseUseCase = async (command) => {
  const kase = await findByCaseRef(command.caseRef);

  if (!kase) {
    throw Boom.notFound(`Case with ref "${command.caseRef}" not found`);
  }

  const { newStatus, supplementaryData } = command;

  kase.updateCaseStatus(newStatus);
  kase.addDataToPhaseStage(supplementaryData);

  await update(kase);

  return kase;
};
