import { countFacets } from "../../cases/repositories/outbox.repository.js";

// The counts describe the whole filtered box, not one page: they are rendered
// above a paged list and must not move as the operator pages through it. The
// filter is exactly the list's, minus the cursor and minus `status` - which is
// what is being counted.
export const countOutboxUseCase = async ({ q, error, from, to }) =>
  countFacets({ q, error, from, to });
