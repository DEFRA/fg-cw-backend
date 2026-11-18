// Pure collection operations. Selection and business rules belong to callers.
export const count = (items) => items.length;
export const first = (items) => items[0] ?? null;
