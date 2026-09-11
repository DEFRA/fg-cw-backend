import { countFacets } from "../repositories/inbox.repository.js";

// The counts describe the whole filtered box and must not move as the operator
// pages: the filter is exactly the list's, minus the cursor and minus
// `status` - which is what is being counted.
export const countInboxUseCase = async ({ q, error, from, to, audit }) =>
  countFacets({ q, error, from, to, audit });
