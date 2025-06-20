import { User } from "../models/user.js";
import { save } from "../repositories/user.repository.js";

export const createUserUseCase = async (createUserCommand) => {
  const user = new User({
    firstName: createUserCommand.firstName,
    lastName: createUserCommand.lastName,
    email: createUserCommand.email,
    roles: createUserCommand.roles,
  });

  await save(user);

  return user;
};
