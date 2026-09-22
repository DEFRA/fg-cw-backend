// A BSON Date, not a string: a TTL index silently ignores a field holding
// anything else, so a row carrying a string here would never be deleted.
const DAY_MS = 86_400_000;

export const expiryFrom = (date, days) =>
  new Date(date.getTime() + days * DAY_MS);
