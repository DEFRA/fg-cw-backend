import Boom from "@hapi/boom";
import { findById } from "../repositories/case.repository.js";

export const findCaseByIdUseCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  return kase;
};
