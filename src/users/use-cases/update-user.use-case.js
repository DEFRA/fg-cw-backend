import { update } from "../repositories/user.repository.js";
import { findUserByIdUseCase } from "./find-user-by-id.use-case.js";

const replace = (user, props, prop) => {
  if (props[prop]) {
    user[prop] = props[prop];
    user.updatedAt = new Date().toISOString();
  }
};

export const updateUserUseCase = async ({ userId, props }) => {
  const user = await findUserByIdUseCase(userId);

  replace(user, props, "name");
  replace(user, props, "idpRoles");
  user.appRoles = user.createAppRole(props);

  await update(user);

  return user;
};
