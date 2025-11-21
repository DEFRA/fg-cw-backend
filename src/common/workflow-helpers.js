/**
 * Finds an external action in a workflow by action code.
 */
export const findExternalAction = (actionValue, workflow) => {
  if (typeof actionValue !== "string" || !workflow.externalActions) {
    return null;
  }

  return workflow.externalActions.find((action) => action.code === actionValue);
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
