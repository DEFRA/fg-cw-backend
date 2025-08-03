import { update } from "../repositories/user.repository.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

export const updateUserRoleUseCase = async ({ userId, props }) => {
  const user = await findUserByIdUseCase(userId);

  user.appRoles = user.createAppRole(props);
  user.updatedAt = new Date().toISOString();

  await update(user);

  return user;
};
