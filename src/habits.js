export function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function mergeDailyActivity(activity = [], patch = {}, now = new Date()) {
  const date = localDateKey(now);
  const current = activity.find((entry) => entry.date === date) || { date };
  return [{ ...current, ...patch, date }, ...activity.filter((entry) => entry.date !== date)].slice(0, 60);
}

export function getPracticeRhythm(activity = [], now = new Date(), days = 7) {
  const activeDates = new Set(activity.filter((entry) => entry.practiced || entry.recorded).map((entry) => entry.date));
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    const key = localDateKey(date);
    return {
      key,
      label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date).slice(0, 1),
      active: activeDates.has(key),
      today: index === days - 1,
    };
  });
}
