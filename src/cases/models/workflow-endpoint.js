import Joi from "joi";
import { validateProps } from "../../common/validation.js";

export class WorkflowEndpoint {
  constructor({ code, service, path, method }) {
    this.code = code;
    this.service = service;
    this.path = path;
    this.method = method;
  }

  static fromDefinition(definition) {
    validateProps(
      definition,
      WorkflowEndpoint.definitionSchema,
      `WorkflowEndpoint "${definition?.code}"`,
    );

    return new WorkflowEndpoint(definition);
  }

  static createMock(props) {
    return new WorkflowEndpoint({
      code: "rules-engine-endpoint",
      service: "RULES_ENGINE",
      path: "/case-management-adapter/application/validation-run/{runId}",
      method: "GET",
      ...props,
    });
  }
}

WorkflowEndpoint.definitionSchema = Joi.object({
  code: Joi.string().required(),
  service: Joi.string().required(),
  path: Joi.string().required(),
  method: Joi.string()
    .valid("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE")
    .required(),
}).unknown();
