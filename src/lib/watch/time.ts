/** Watch timestamps are stored as UTC ("YYYY-MM-DD HH:MM:SS" or ISO). The UI reads UTC+7. */
const WATCH_TIME_ZONE = "Asia/Ho_Chi_Minh";

function parse(raw: string): Date | null {
  const value = raw.includes("T") ? raw : `${raw.replace(" ", "T")}Z`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Render a watch timestamp for the UI.
 * Unknown or missing input becomes a visible marker — a page must never show a
 * blank where "chưa kiểm tra" belongs.
 */
export function formatWatchTime(raw: string | null, options: { iso?: boolean } = {}): string {
  if (!raw) return options.iso ? "" : "—";
  const date = parse(raw);
  if (!date) return options.iso ? "" : "—";
  if (options.iso) return raw;
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: WATCH_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: WATCH_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
  }).format(date);
  return `${time} ${day}`;
}
