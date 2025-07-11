import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findAll } from "../repositories/case.repository.js";

export const findCasesUseCase = async () => {
  const cases = await findAll();

  const assignedUserIds = cases.map((c) => c.assignedUser?.id).filter(Boolean);

  const users = await findUsersUseCase({
    ids: assignedUserIds,
  });

  for (const kase of cases) {
    const assignedUser = users.find((u) => u.id === kase.assignedUser?.id);

    if (assignedUser) {
      kase.assignedUser.name = assignedUser.name;
    }
  }

  return cases;
};
