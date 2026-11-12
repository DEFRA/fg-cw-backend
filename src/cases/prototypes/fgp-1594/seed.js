// THROWAWAY: synthetic documents using the repository's stored case shape.
export const users = [{ id: "spike-user", name: "Alex Caseworker" }];

export const makeCase = (caseRef, sbi, overrides = {}) => ({
  caseRef,
  workflowCode: "frps-private-beta",
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW_APPLICATION",
  currentStatus: "APPLICATION_IN_REVIEW",
  createdAt: new Date(
    `2026-11-${String((Number(caseRef.slice(-2)) % 9) + 1).padStart(2, "0")}T10:00:00Z`,
  ),
  payload: {
    identifiers: { sbi },
    answers: { applicant: { business: { name: `Farm ${sbi}` } } },
  },
  labels: [],
  timeline: [],
  ...overrides,
});

export const seed = () => [
  makeCase("300241", "244666513"),
  makeCase("300242", "244666513"),
  makeCase("300243", "244666513", { currentStatus: "APPLICATION_REJECTED" }),
  makeCase("300244", "244666514"),
  makeCase("300245", "244666514"),
  makeCase("300246", "244666515"),
  makeCase("300247", "244666515"),
  makeCase("300248", "244666516"),
  makeCase("300249", "244666513", { currentStage: "REVIEW_OFFER" }),
  makeCase("300250", "244666513", { workflowCode: "another-scheme" }),
  makeCase("300251", null),
  makeCase("300252", null),
];
