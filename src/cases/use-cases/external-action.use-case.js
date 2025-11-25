import Boom from "@hapi/boom";
import { callExternalEndpoint } from "../../common/external-endpoint-client.js";
import { extractEndpointParameters } from "../../common/parameter-resolver.js";

export class ExternalActionUseCase {
  constructor({ endpointClient, parameterResolver }) {
    this.endpointClient = endpointClient;
    this.parameterResolver = parameterResolver;
  }

  static create() {
    return new ExternalActionUseCase({
      endpointClient: { callExternalEndpoint },
      parameterResolver: { extractEndpointParameters },
    });
  }

  async execute({ actionCode, caseWorkflowContext, throwOnError = false }) {
    try {
      const action = this.validateAction(
        actionCode,
        caseWorkflowContext.workflow,
      );
      const endpoint = this.validateEndpoint(
        action.endpoint.code,
        caseWorkflowContext.workflow,
      );

      const params = await this.prepareParameters({
        actionCode,
        caseWorkflowContext,
      });

      const response = await this.callEndpoint(
        endpoint,
        params,
        caseWorkflowContext,
        throwOnError,
      );

      return this.processResponse(response);
    } catch (error) {
      return this.handleError(error, throwOnError);
    }
  }

  validateAction(actionCode, workflow) {
    const action = workflow.findExternalAction(actionCode);

    if (!action?.endpoint?.code) {
      throw Boom.notFound(`No endpoint defined for action: ${actionCode}`);
    }

    return action;
  }

  validateEndpoint(endpointCode, workflow) {
    const endpoint = workflow.findEndpoint(endpointCode);

    if (!endpoint) {
      throw Boom.notFound(`Endpoint not found: ${endpointCode}`);
    }

    return endpoint;
  }

  async prepareParameters({ actionCode, caseWorkflowContext }) {
    return this.parameterResolver.extractEndpointParameters({
      actionCode,
      caseWorkflowContext,
    });
  }

  async callEndpoint(endpoint, params, context, throwOnError) {
    return this.endpointClient.callExternalEndpoint(
      endpoint,
      params,
      context,
      throwOnError,
    );
  }

  processResponse(response) {
    if (!response) {
      return {};
    }

    return response;
  }

  handleError(error, throwOnError) {
    if (throwOnError) {
      throw error;
    }

    return {};
  }
}
