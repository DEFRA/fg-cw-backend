import { User } from "../models/user.js";
import { save } from "../repositories/user.repository.js";

export const createUserUseCase = async (props) => {
  const createdAt = new Date().toISOString();

  const user = new User({
    idpId: props.idpId,
    name: props.name,
    email: props.email,
    idpRoles: props.idpRoles,
    appRoles: props.appRoles,
    createdAt,
    updatedAt: createdAt,
  });

  await save(user);

  return user;
};
