export class WorkflowEndpoint {
  constructor({ code, service, path, method, request = null }) {
    this.code = code;
    this.service = service;
    this.path = path;
    this.method = method;
    this.request = request;
  }

  static createMock(props) {
    return new WorkflowEndpoint({
      code: "rules-engine-endpoint",
      service: "RULES_ENGINE",
      path: "/case-management-adapter/application/validation-run/{runId}",
      method: "GET",
      request: null,
      ...props,
    });
  }
}
