import { findAll } from "../repositories/user.repository.js";

export const findUsersUseCase = (query) => {
  return findAll(query);
};
