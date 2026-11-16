import { DedupeError } from "./dedupe-label.js";

export class GroupAssignment {
  constructor(key, assignee = null) {
    this.key = key;
    this.assignee = assignee;
  }

  // eslint-disable-next-line complexity -- Validate owner eligibility and compare nullable assignments.
  assign(id, eligibleUsers) {
    const selected =
      id === null ? null : eligibleUsers.find((user) => user.id === id);
    if (id !== null && !selected)
      throw new DedupeError("Choose an eligible issue owner");
    const changed = this.assignee?.id !== selected?.id;
    this.assignee = selected;
    return changed;
  }
}
