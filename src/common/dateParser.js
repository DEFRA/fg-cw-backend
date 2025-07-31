export const parseToUTCDate = (value) => {
  const [day, month, year] = value.split("/");

  return new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
};
