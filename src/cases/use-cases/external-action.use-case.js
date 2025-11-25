import { callExternalEndpoint } from "../../common/external-endpoint-client.js";
import { logger } from "../../common/logger.js";
import { extractEndpointParameters } from "../../common/parameter-resolver.js";

export class ExternalActionUseCase {
  constructor({ endpointClient, parameterResolver, logger: loggerInstance }) {
    this.endpointClient = endpointClient;
    this.parameterResolver = parameterResolver;
    this.logger = loggerInstance;
  }

  static create() {
    return new ExternalActionUseCase({
      endpointClient: { callExternalEndpoint },
      parameterResolver: { extractEndpointParameters },
      logger,
    });
  }

  async execute({ actionCode, caseWorkflowContext, throwOnError = false }) {
    try {
      this.logExecutionStart(actionCode);

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

      return this.processResponse(response, endpoint.code, actionCode);
    } catch (error) {
      return this.handleError(error, actionCode, throwOnError);
    }
  }

  validateAction(actionCode, workflow) {
    const action = workflow.findExternalAction(actionCode);

    if (!action?.endpoint?.code) {
      this.logger.warn(
        { actionCode },
        `No endpoint defined for action: ${actionCode}`,
      );
      throw new Error(`No endpoint defined for action: ${actionCode}`);
    }

    return action;
  }

  validateEndpoint(endpointCode, workflow) {
    const endpoint = workflow.findEndpoint(endpointCode);

    if (!endpoint) {
      this.logger.warn({ endpointCode }, `Endpoint not found: ${endpointCode}`);
      throw new Error(`Endpoint not found: ${endpointCode}`);
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

  processResponse(response, endpointCode, actionCode) {
    if (!response) {
      this.logger.warn(
        { endpoint: endpointCode },
        `No response from external endpoint: ${endpointCode}`,
      );
      return {};
    }

    this.logger.info(
      { actionCode, endpoint: endpointCode },
      `Successfully executed external action: ${actionCode}`,
    );

    return response;
  }

  handleError(error, actionCode, throwOnError) {
    this.logger.error(
      { error, actionCode },
      `Failed to execute action ${actionCode}: ${error.message}`,
    );

    if (throwOnError) {
      throw error;
    }

    return {};
  }

  logExecutionStart(actionCode) {
    this.logger.info(
      { actionCode },
      `Starting external action execution: ${actionCode}`,
    );
  }
}
