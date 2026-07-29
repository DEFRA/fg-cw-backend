import Boom from "@hapi/boom";
import { findById } from "../repositories/case.repository.js";

// Loads a case by command.caseId and records the resolved caseRef back onto the
// command. Route-driven use-cases receive a caseId whereas message-driven ones
// receive a caseRef; recording the caseRef here lets every audit data builder
// use a consistent caseRef as the entityid.
export const loadCase = async (command) => {
  const kase = await findById(command.caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${command.caseId}" not found`);
  }

  command.caseRef = kase.caseRef;

  return kase;
};
