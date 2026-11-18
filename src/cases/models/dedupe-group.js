import { count } from "../../common/collections.js";
import {
  DedupeError,
  assessmentStatus,
  assessmentFor,
  normaliseDedupeAssessment,
  sameAssessment,
} from "./dedupe-assessment.js";

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

  get duplicateCases() {
    return this.activeCases.filter(
      (kase) => assessmentFor(kase)?.code === "DUPLICATE",
    );
  }

  get notDuplicateCases() {
    return this.activeCases.filter(
      (kase) => assessmentFor(kase)?.code === "NOT_DUPLICATE",
    );
  }

  get unassessedCases() {
    return this.activeCases.filter((kase) => !assessmentFor(kase));
  }

  get counts() {
    return {
      total: count(this.cases),
      excluded: count(this.excludedCases),
      notSet: count(this.unassessedCases),
      notDuplicate: count(this.notDuplicateCases),
      duplicate: count(this.duplicateCases),
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
      const label = normaliseDedupeAssessment(input, caseRef);
      if (sameAssessment(assessmentFor(kase), label)) continue;
      if (this.isExcluded(kase))
        throw new DedupeError("Excluded cases cannot be labelled", caseRef);
      if (
        label?.code === "DUPLICATE" &&
        !this.duplicateTargets(caseRef).some(
          (other) => other.caseRef === label.duplicateOf,
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
        assessmentFor(kase)?.duplicateOf,
      ]),
    );
    for (const [ref, label] of Object.entries(changes))
      edges.set(ref, label?.duplicateOf);
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
