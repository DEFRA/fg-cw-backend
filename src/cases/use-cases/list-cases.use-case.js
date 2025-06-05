import { findAll } from "../repositories/find-all.repository.js";
export const findCasesUseCase = async (listQuery) => {
  return findAll(listQuery);
};
