import Boom from "@hapi/boom";
import { AccessControl } from "../../cases/models/access-control.js";
import { findWorkflowByCodeUseCase } from "../../cases/use-cases/find-workflow-by-code.use-case.js";

export const findSecretWorkflowUseCase = async (workflowCode, user) => {
  const workflow = await findWorkflowByCodeUseCase(workflowCode);
  if (!workflow) {
    throw Boom.notFound(`Workflow with code "${workflowCode}" not found`);
  }

  const accessControl = new AccessControl(user);
  accessControl.authorise(workflow.requiredRoles);

  return {
    message: "Access granted to workflow",
    timestamp: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      idpId: user.idpId,
      idpRoles: user.idpRoles,
      appRoles: user.appRoles,
    },
    workflow: {
      code: workflow.code,
      requiredRoles: workflow.requiredRoles,
    },
  };
};
