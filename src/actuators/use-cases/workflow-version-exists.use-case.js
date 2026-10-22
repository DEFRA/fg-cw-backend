import { configVersionExists } from "../../cases/repositories/config-version.repository.js";

// Yes or no only, so nothing is released and nothing is audited here: the
// caller's page audit records the operator's view.
export const workflowVersionExistsUseCase = async ({ code, version }) => ({
  exists: await configVersionExists({ grantCode: code, version }),
});
