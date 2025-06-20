import { findAll } from "../repositories/user.repository.js";

export const findUsersUseCase = async () => {
  return findAll();
};
