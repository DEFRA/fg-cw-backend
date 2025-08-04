import { Note } from "../models/note.js";
import { update } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";

export const addNoteToCaseUseCase = async (command) => {
  const { caseId, type, content } = command;

  const kase = await findCaseByIdUseCase(caseId);

  const note = new Note({
    type,
    content,
    createdBy: "System", // TODO: This should be coming from the JWT token
  });
  kase.addNote(note);

  await update(kase);

  return note;
};
