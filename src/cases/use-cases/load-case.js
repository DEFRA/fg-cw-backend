import Boom from "@hapi/boom";
import { findById } from "../repositories/case.repository.js";

export const loadCase = async (command, session) => {
  const kase = await findById(command.caseId, session);

  if (!kase) {
    throw Boom.notFound(`Case with id "${command.caseId}" not found`);
  }

  command.caseRef = kase.caseRef;

  return kase;
};
