import { findAll } from "../repositories/user.repository.js";

export const findAssigneesUseCase = async ({
  allAppRoles = [],
  anyAppRoles = [],
}) => {
  const users = await findAll({ allAppRoles, anyAppRoles });

  return users.map(({ id, name }) => ({ id, name })).sort(byName);
};

const byName = ({ name: a = "" }, { name: b = "" }) =>
  a.localeCompare(b, "en", { sensitivity: "base" });
