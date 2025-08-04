import { getAuthenticatedUser } from "../../common/auth.js";
import { Comment } from "../models/comment.js";
import { findById, update } from "../repositories/case.repository.js";

export const addNoteToCaseUseCase = async (command) => {
  const { caseId, type, text } = command;

  const kase = await findById(caseId);

  const comment = new Comment({
    type,
    text,
    createdBy: getAuthenticatedUser().id,
  });

  kase.addComment(comment);

  await update(kase);

  return comment;
};
