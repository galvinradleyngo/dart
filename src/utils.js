export function uid() {
  return crypto.randomUUID();
}

export const todayStr = () => new Date().toISOString().slice(0, 10);
export const fmt = (d) => new Date(d).toISOString().slice(0, 10);
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

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
