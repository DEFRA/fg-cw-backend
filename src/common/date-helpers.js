export const isDateString = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

  if (!isoDateRegex.test(value)) {
    return false;
  }

  const date = new Date(value);
  return !isNaN(date.getTime());
};
