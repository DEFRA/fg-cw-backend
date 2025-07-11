import Boom from "@hapi/boom";
import { findUserByIdUseCase } from "../../users/use-cases/find-user-by-id.use-case.js";
import { findById } from "../repositories/case.repository.js";

export const findCaseByIdUseCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  if (kase.assignedUser) {
    const user = await findUserByIdUseCase(kase.assignedUser.id);

    kase.assignedUser.name = user.name;
  }

  return kase;
};
