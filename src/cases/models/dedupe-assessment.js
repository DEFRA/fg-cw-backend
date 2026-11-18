import { count } from "../../common/collections.js";

export class DedupeError extends Error {
  constructor(message, caseRef = null) {
    super(message);
    this.name = "DedupeError";
    this.caseRef = caseRef;
  }
}
export const assessmentFor = (kase) => kase.dedupeAssessment ?? null;

// eslint-disable-next-line complexity
export const normaliseDedupeAssessment = (assessment, caseRef) => {
  if (assessment === null) return null;
  if (assessment?.code === "NOT_DUPLICATE" && !assessment.duplicateOf)
    return { code: "NOT_DUPLICATE" };
  if (
    assessment?.code !== "DUPLICATE" ||
    typeof assessment.duplicateOf !== "string" ||
    !assessment.duplicateOf
  )
    throw new DedupeError("Choose a valid duplicate assessment", caseRef);
  if (assessment.duplicateOf === caseRef)
    throw new DedupeError("A case cannot be a duplicate of itself", caseRef);
  return { code: "DUPLICATE", duplicateOf: assessment.duplicateOf };
};
// eslint-disable-next-line complexity
export const sameAssessment = (a, b) =>
  a?.code === b?.code && a?.duplicateOf === b?.duplicateOf;
export const assessmentStatus = (activeCases) => {
  const remaining = count(activeCases.filter((kase) => !assessmentFor(kase)));
  if (remaining === count(activeCases)) return "NOT_STARTED";
  return remaining === 0 ? "COMPLETED" : "IN_PROGRESS";
};
