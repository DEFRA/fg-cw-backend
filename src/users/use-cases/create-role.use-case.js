import { Role } from "../models/role.js";
import { save } from "../repositories/role.repository.js";

export const createRoleUseCase = async (props) => {
  const createdAt = new Date().toISOString();

  const role = new Role({
    code: props.code,
    description: props.description,
    createdAt,
    updatedAt: createdAt,
  });

  await save(role);

  return role;
};
