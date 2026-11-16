import {
  DedupeError,
  assessmentStatus,
  labelCount,
  unlabelledCount,
  labelFor,
  normaliseDedupeLabel,
  sameLabel,
} from "./dedupe-label.js";

// A calculated domain read model, not an aggregate owning the member Cases.
export class DedupeGroup {
  constructor(key, cases, excludedStatuses) {
    this.key = key;
    this.cases = cases;
    this.excludedStatuses = excludedStatuses;
  }

  isExcluded(kase) {
    return this.excludedStatuses.includes(kase.currentStatus);
  }

  get activeCases() {
    return this.cases.filter((kase) => !this.isExcluded(kase));
  }

  get excludedCases() {
    return this.cases.filter((kase) => this.isExcluded(kase));
  }

  get visible() {
    return this.activeCases.length >= 2;
  }

  get counts() {
    const active = this.activeCases;
    return {
      total: this.cases.length,
      excluded: this.cases.length - active.length,
      notSet: unlabelledCount(active),
      notDuplicate: labelCount(active, "NOT_DUPLICATE"),
      duplicate: labelCount(active, "DUPLICATE"),
    };
  }

  get status() {
    return assessmentStatus(this.activeCases);
  }

  duplicateTargets(caseRef) {
    return this.activeCases.filter((kase) => kase.caseRef !== caseRef);
  }

  // Sequential validation only: simultaneous saves remain a documented spike limitation.
  // eslint-disable-next-line complexity
  validateLabels(submission, referencedCases = []) {
    const changes = {};
    for (const [caseRef, input] of Object.entries(submission)) {
      const kase = this.cases.find((item) => item.caseRef === caseRef);
      if (!kase)
        throw new DedupeError("Case no longer belongs to this group", caseRef);
      const label = normaliseDedupeLabel(input, caseRef);
      if (sameLabel(labelFor(kase), label)) continue;
      if (this.isExcluded(kase))
        throw new DedupeError("Excluded cases cannot be labelled", caseRef);
      if (
        label?.code === "DUPLICATE" &&
        !this.duplicateTargets(caseRef).some(
          (other) => other.caseRef === label.data.duplicateOf,
        )
      )
        throw new DedupeError(
          "Choose another active case in this group",
          caseRef,
        );
      changes[caseRef] = label;
    }
    this.assertNoCycles(changes, referencedCases);
    return changes;
  }

  // Include historical references, even when their cases have left scope.
  // eslint-disable-next-line complexity
  assertNoCycles(changes, referencedCases) {
    const edges = new Map(
      [...referencedCases, ...this.cases].map((kase) => [
        kase.caseRef,
        labelFor(kase)?.data?.duplicateOf,
      ]),
    );
    for (const [ref, label] of Object.entries(changes))
      edges.set(ref, label?.data?.duplicateOf);
    for (const kase of this.cases) {
      const visited = new Set();
      let ref = kase.caseRef;
      while (ref) {
        if (visited.has(ref))
          throw new DedupeError(
            "Duplicate references must not form a cycle",
            kase.caseRef,
          );
        visited.add(ref);
        ref = edges.get(ref);
      }
    }
  }
}
