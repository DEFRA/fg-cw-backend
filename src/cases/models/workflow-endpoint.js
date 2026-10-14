export class WorkflowEndpoint {
  constructor({ code, service, path, method, sendCaseworkerEmail = false }) {
    this.code = code;
    this.service = service;
    this.path = path;
    this.method = method;
    this.sendCaseworkerEmail = sendCaseworkerEmail;
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
