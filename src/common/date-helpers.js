export const toIsoOrNull = (value) =>
  value instanceof Date ? value.toISOString() : (value ?? null);

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

const UK_TIME_ZONE = "Europe/London";
const LAST_HOUR = 23;
const LAST_MINUTE = 59;
const LAST_SECOND = 59;

const ukClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
});

const ukClockOf = (instant) =>
  Object.fromEntries(
    ukClock
      .formatToParts(instant)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, Number(value)]),
  );

const asUtc = ({ year, month, day, hour, minute, second }) =>
  Date.UTC(year, month - 1, day, hour, minute, second);

// 23:59:59 UK time, in GMT or BST, on the UK day the instant falls on. The
// UK's clocks change at 01:00 UTC, so the offset at 23:59:59 UTC that day is
// the one in force at 23:59:59 UK time.
export const endOfUkDay = (instant) => {
  const { year, month, day } = ukClockOf(instant);
  const lastSecond = asUtc({
    year,
    month,
    day,
    hour: LAST_HOUR,
    minute: LAST_MINUTE,
    second: LAST_SECOND,
  });
  const offset = asUtc(ukClockOf(new Date(lastSecond))) - lastSecond;

  return new Date(lastSecond - offset);
};
