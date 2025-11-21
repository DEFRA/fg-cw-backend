import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findById, update } from "../repositories/case.repository.js";

export const addNoteToCaseUseCase = async (command) => {
  const { caseId, text, user } = command;

  logger.debug(
    { caseId, userId: user.id, hasText: !!text },
    "Adding note to case use case started",
  );

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const note = kase.addNote({
    text,
    createdBy: user.id,
  });

  await update(kase);

  logger.debug({ caseId, noteRef: note.ref }, "Case updated with new note");

  return note;
};
