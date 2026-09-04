export function londonDateParts(now = new Date()) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const lookup = Object.fromEntries(values.map((part) => [part.type, part.value]));
  return { date: `${lookup.year}-${lookup.month}-${lookup.day}`, hour: Number(lookup.hour), weekday: lookup.weekday };
}

export function isLondonDigestTime(now = new Date()) {
  const { hour, weekday } = londonDateParts(now);
  return hour === 9 && weekday !== "Sat" && weekday !== "Sun";
}
