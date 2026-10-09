import { countFacets } from "../../cases/repositories/outbox.repository.js";

export const countOutboxUseCase = ({ q, error, from, to, audit }) =>
  countFacets({ q, error, from, to, audit });
