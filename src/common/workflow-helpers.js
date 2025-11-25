/**
 * Finds an external action in a workflow by action code.
 */
export const findExternalAction = (actionCode, workflow) => {
  if (typeof actionCode !== "string" || !workflow.externalActions) {
    return null;
  }

  return workflow.externalActions.find((action) => action.code === actionCode);
};

/**
 * Finds an endpoint in a workflow by endpoint code.
 */
export const findEndpoint = (endpointCode, workflow) => {
  if (!workflow.endpoints) {
    return null;
  }

  return workflow.endpoints.find((endpoint) => endpoint.code === endpointCode);
};
