import { findAll } from "../../repositories/case.repository.js";
export const findCasesUseCase = async (listQuery) => {
  return findAll(listQuery);
};
