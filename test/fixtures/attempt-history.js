export const anAttemptHistory = ({ length, message }) =>
  Array.from({ length }, (_, i) => ({
    at: new Date(Date.UTC(2026, 5, 16, 10, i)).toISOString(),
    name: "TypeError",
    message,
    stack: null,
  }));
