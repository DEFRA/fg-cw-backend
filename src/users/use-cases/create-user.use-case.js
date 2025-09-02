import { AppRole } from "../models/app-role.js";
import { User } from "../models/user.js";
import { save } from "../repositories/user.repository.js";

export const createUserUseCase = async (props) => {
  const createdAt = new Date().toISOString();

  const appRoles = Object.entries(props.appRoles).reduce(
    (acc, [code, value]) => {
      acc[code] = new AppRole(value);
      return acc;
    },
    {},
  );

  const user = new User({
    idpId: props.idpId,
    name: props.name,
    email: props.email,
    idpRoles: props.idpRoles,
    appRoles,
    createdAt,
    updatedAt: createdAt,
  });

  await save(user);

  return user;
};
