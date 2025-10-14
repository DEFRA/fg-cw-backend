import Boom from "@hapi/boom";
import { findById, update } from "../repositories/case.repository.js";

export const addNoteToCaseUseCase = async (command) => {
  const { caseId, text, user } = command;

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const note = kase.addNote({
    text,
    createdBy: user.id,
  });

  await update(kase);

  return note;
};
