export const DEDUPE_NAMESPACE = "duplicates";

export class DedupeError extends Error {
  constructor(message, caseRef = null) {
    super(message);
    this.name = "DedupeError";
    this.caseRef = caseRef;
  }
}
export const labelFor = (kase) =>
  kase.labels?.find((label) => label.namespace === DEDUPE_NAMESPACE) ?? null;

// eslint-disable-next-line complexity
export const normaliseDedupeLabel = (label, caseRef) => {
  if (label === null) return null;
  if (label?.code === "NOT_DUPLICATE" && !label.data?.duplicateOf)
    return { code: "NOT_DUPLICATE", data: null };
  if (
    label?.code !== "DUPLICATE" ||
    typeof label.data?.duplicateOf !== "string" ||
    !label.data.duplicateOf
  )
    throw new DedupeError("Choose a valid duplicate label", caseRef);
  if (label.data.duplicateOf === caseRef)
    throw new DedupeError("A case cannot be a duplicate of itself", caseRef);
  return { code: "DUPLICATE", data: { duplicateOf: label.data.duplicateOf } };
};
// eslint-disable-next-line complexity
export const sameLabel = (a, b) =>
  a?.code === b?.code && a?.data?.duplicateOf === b?.data?.duplicateOf;
