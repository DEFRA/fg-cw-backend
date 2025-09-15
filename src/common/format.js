import { logger } from "./logger.js";

export const formatFunctions = {
  formatDate: (value) => {
    const date = new Date(value);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  },

  fixed: (value, decimals) => Number(value).toFixed(decimals),

  yesNo: (value) =>
    value === true ||
    (typeof value === "string" && value.toLowerCase() === "true")
      ? "Yes"
      : "No",
};

export const parseFormatString = (formatString) => {
  const match = formatString.match(/^(\w+)(?:\(([^)]*)\))?$/);
  if (!match) throw new Error(`Invalid format: ${formatString}`);

  const [, name, paramString] = match;
  const params = paramString
    ? paramString.split(",").map((p) => {
        const trimmed = p.trim();
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      })
    : [];

  return { name, params };
};

export const applyFormat = (value, formatString) => {
  try {
    const { name, params } = parseFormatString(formatString);
    const formatFn = formatFunctions[name];

    if (!formatFn) {
      logger.warn(`Unknown format: ${name}`);
      return value;
    }

    return formatFn(value, ...params);
  } catch (error) {
    logger.warn(`Format error: ${error.message}`);
    return value;
  }
};
