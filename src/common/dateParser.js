export const parseToUTCDate = (value, helpers) => {
  const [day, month, year] = value.split("/");

  return new Date(
    Date.UTC(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
    ),
  );
};
