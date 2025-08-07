import { findAll } from "../repositories/role.repository.js";

export const findRolesUseCase = async () => {
  return await findAll();
};
