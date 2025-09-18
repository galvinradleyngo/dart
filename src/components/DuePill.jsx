import React from "react";
import { todayStr } from "../utils.js";

export default function DuePill({ date, status }) {
  if (!date)
    return (
      <span className="inline-block px-2.5 py-1 text-sm rounded-full border border-white/60 bg-white/70 text-slate-500 shadow-sm backdrop-blur">
        —
      </span>
    );
  const today = new Date(todayStr());
  const d = new Date(date);
  const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  let classes = "bg-sky-100/70 text-sky-700 border-sky-200/80";
  if (status !== "done" && diffDays < 0) classes = "bg-red-100/80 text-red-700 border-red-200/80";
  else if (status !== "done" && diffDays <= 2) classes = "bg-amber-100/80 text-amber-700 border-amber-200/80";
  return (
    <span className={`inline-block px-2.5 py-1 text-sm rounded-full border font-semibold shadow-sm backdrop-blur ${classes}`}>
      {date}
    </span>
  );
}
