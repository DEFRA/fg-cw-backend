import { findAll } from "../repositories/case.repository.js";

export const findCasesUseCase = async () => {
  return findAll();
};
