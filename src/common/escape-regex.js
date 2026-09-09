// Every character that means something to a regex engine, so a value that
// contains one is matched as the literal text an operator typed rather than as
// a pattern they did not know they were writing.
const REGEX_META = /[.*+?^${}()|[\]\\]/g;

/**
 * In its own module because both sides of one invariant need it.
 *
 * `event-audit.js` decides which rows ARE audit records and `event-list-filter
 * .js` decides which rows a page leaves out, and those two must be the same
 * predicate - a module header in each says so. They had an escape apiece, so a
 * tweak to one and not the other was exactly the drift they warn against, and
 * neither could import the other's (the filter already imports the audit
 * predicate).
 */
export const escapeRegex = (value) =>
  value.replace(REGEX_META, String.raw`\$&`);
