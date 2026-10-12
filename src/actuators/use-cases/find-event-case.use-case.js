import { caseExists } from "../../cases/repositories/case.repository.js";

const isRef = (value) => typeof value === "string" && value.length > 0;

const namedCase = (event) => {
  const { caseRef, workflowCode } = event?.data ?? {};

  return [caseRef, workflowCode].every(isRef)
    ? { workflowCode, caseRef }
    : null;
};

// The case an event names, from the two platform fields its rows carry, and
// whether it exists. Nothing else in the event is read.
export const findEventCaseUseCase = async (event) => {
  const key = namedCase(event);

  if (!key) {
    return null;
  }

  return { ...key, exists: await caseExists(key) };
};
