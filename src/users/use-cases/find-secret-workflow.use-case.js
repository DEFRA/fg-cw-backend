import Boom from "@hapi/boom";
import { AccessControl } from "../../cases/models/access-control.js";
import { findWorkflowByCodeUseCase } from "../../cases/use-cases/find-workflow-by-code.use-case.js";
import { logger } from "../../common/logger.js";

export const findSecretWorkflowUseCase = async ({ workflowCode, user }) => {
  logger.info(`Authorising workflow "${workflowCode}" for user "${user.id}"`);
  const workflow = await findWorkflowByCodeUseCase(workflowCode);
  if (!workflow) {
    throw Boom.notFound(`Workflow with code "${workflowCode}" not found`);
  }

  const accessControl = new AccessControl(user);
  accessControl.authorise(workflow.requiredRoles);

  logger.info(
    `Finished: authorising workflow ${workflowCode} for user ${user.id}`,
  );

  return {
    message: "Access granted to workflow",
    workflow: {
      code: workflow.code,
      requiredRoles: workflow.requiredRoles,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      appRoles: user.appRoles,
    },
  };
};
