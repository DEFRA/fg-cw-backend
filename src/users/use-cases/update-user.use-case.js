import { update } from "../repositories/user.repository.js";

export const updateUserUseCase = async (command) => {
  await update(command.userId, command.props);
};
