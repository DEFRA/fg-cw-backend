import Boom from "@hapi/boom";
import { findById } from "../repositories/user.repository.js";

export const findUserByIdUseCase = async (userId) => {
  const user = await findById(userId);

  if (!user) {
    throw Boom.notFound(`User with id "${userId}" not found`);
  }

  return user;
};
