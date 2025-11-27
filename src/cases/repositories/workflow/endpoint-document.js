export class EndpointDocument {
  constructor(endpoint) {
    this.code = endpoint.code;
    this.service = endpoint.service;
    this.path = endpoint.path;
    this.method = endpoint.method;
  }

  static createMock(props) {
    return new EndpointDocument({
      code: "rules-engine-endpoint",
      service: "RULES_ENGINE",
      path: "/case-management-adapter/application/validation-run/{runId}",
      method: "GET",
      ...props,
    });
  }
}
