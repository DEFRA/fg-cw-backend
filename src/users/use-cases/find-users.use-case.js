import { findAll } from "../repositories/user.repository.js";

export const findUsersUseCase = async (query) => {
  return findAll(query);
};
