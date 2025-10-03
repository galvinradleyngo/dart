export function uid() {
  return crypto.randomUUID();
}

const formatLocalDate = (date) => {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid time value");
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const todayStr = () => formatLocalDate(new Date());
export const fmt = (d) => formatLocalDate(new Date(d));
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const tryParseUrl = (value) => {
  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
};

export const normalizeUrl = (rawUrl) => {
  if (typeof rawUrl !== "string") return null;
  const candidate = rawUrl.trim();
  if (!candidate) return null;
  return tryParseUrl(candidate) ?? tryParseUrl(`https://${candidate}`);
};

export const rolePalette = {
  LD: "#4f46e5",
  SME: "#16a34a",
  MM: "#0891b2",
  PM: "#ea580c",
  PA: "#a855f7",
  Other: "#64748b",
};
export const roleOrder = Object.keys(rolePalette);
export const roleColor = (roleType) => rolePalette[roleType] || rolePalette.Other;

export const ensureArray = (value) => (Array.isArray(value) ? value : []);

export const getAssigneeIds = (task) => {
  if (!task) return [];
  const ids = ensureArray(task.assigneeIds);
  if (ids.length > 0) {
    return ids.filter((id) => typeof id === "string" && id.trim() !== "");
  }
  const fallback = typeof task.assigneeId === "string" && task.assigneeId.trim() !== "" ? [task.assigneeId] : [];
  return fallback;
};

export const nextMemberName = (list) => {
  const base = "New Member";
  const names = new Set(list.map((m) => m.name));
  let name = base;
  let i = 2;
  while (names.has(name)) {
    name = `${base} ${i++}`;
  }
  return name;
};

export const isHoliday = (dateObj, holidaySet) => holidaySet.has(fmt(dateObj));
export const isWorkday = (dateObj, workweekSet) => workweekSet.has(dateObj.getDay());

export const addBusinessDays = (dateStr, workdays, workweek = [1,2,3,4,5], holidays = []) => {
  if (!dateStr || isNaN(workdays)) return "";
  const workweekSet = new Set(workweek);
  const holidaySet = new Set(holidays);
  let remaining = Number(workdays);
  let cur = new Date(dateStr);
  while (!isWorkday(cur, workweekSet) || isHoliday(cur, holidaySet)) cur.setDate(cur.getDate() + 1);
  let counted = 0;
  while (counted < remaining) {
    cur.setDate(cur.getDate() + 1);
    if (isWorkday(cur, workweekSet) && !isHoliday(cur, holidaySet)) counted++;
  }
  return fmt(cur);
};

export const ensureHexColor = (value, fallback = rolePalette.Other) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9A-Fa-f]{8}$/.test(trimmed)) {
    return trimmed.slice(0, 7).toLowerCase();
  }
  return fallback;
};

export const withAlpha = (hex, alpha = 0.16) => {
  const base = ensureHexColor(hex);
  const boundedAlpha = clamp(alpha, 0, 1);
  const alphaHex = Math.round(boundedAlpha * 255)
    .toString(16)
    .padStart(2, "0");
  return `${base}${alphaHex}`;
};
