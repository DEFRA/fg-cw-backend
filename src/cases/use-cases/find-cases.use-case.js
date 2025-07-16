import { findUsersUseCase } from "../../users/use-cases/find-users.use-case.js";
import { findAll } from "../repositories/case.repository.js";
import { findWorkflowsUseCase } from "./find-workflows.use-case.js";

export const findCasesUseCase = async () => {
  const cases = await findAll();

  const assignedUserIds = cases.map((c) => c.assignedUser?.id).filter(Boolean);
  const workflowCodes = cases.map((c) => c.workflowCode);

  const [users, workflows] = await Promise.all([
    findUsersUseCase({
      ids: assignedUserIds,
    }),
    findWorkflowsUseCase({
      codes: workflowCodes,
    }),
  ]);

  for (const kase of cases) {
    const assignedUser = users.find((u) => u.id === kase.assignedUser?.id);

    if (assignedUser) {
      kase.assignedUser.name = assignedUser.name;
    }

    const workflow = workflows.find((w) => w.code === kase.workflowCode);

    if (workflow) {
      kase.requiredRoles = workflow.requiredRoles;
    }
  }

  return cases;
};
