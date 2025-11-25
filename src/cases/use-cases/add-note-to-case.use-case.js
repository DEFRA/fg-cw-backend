import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { findById, update } from "../repositories/case.repository.js";

export const addNoteToCaseUseCase = async (command) => {
  const { caseId, text, user } = command;

  logger.debug(
    `Adding note to case use case started - caseId: ${caseId}, userId: ${user.id}`,
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

  logger.debug(
    `Finished: Adding note to case use case started - caseId: ${caseId}, userId: ${user.id}, noteRef: ${note.ref}`,
  );

  return note;
};
