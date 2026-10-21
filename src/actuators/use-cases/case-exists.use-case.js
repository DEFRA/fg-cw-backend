import { caseExists } from "../../cases/repositories/case.repository.js";

// Yes or no only, so nothing is released and nothing is audited here: the
// caller's page audit records the operator's view.
export const caseExistsUseCase = async ({ workflowCode, caseRef }) => ({
  exists: await caseExists({ workflowCode, caseRef }),
});
