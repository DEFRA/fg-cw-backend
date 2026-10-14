export class EndpointDocument {
  // The fields named here are the only ones stored, whatever else a definition carries.
  constructor(endpoint) {
    this.code = endpoint.code;
    this.service = endpoint.service;
    this.path = endpoint.path;
    this.method = endpoint.method;
    this.sendCaseworkerEmail = endpoint.sendCaseworkerEmail ?? false;
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
