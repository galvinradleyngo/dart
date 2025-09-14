import React from "react";
import { todayStr } from "../utils.js";

export default function DuePill({ date, status }) {
  if (!date)
    return (
      <span className="inline-block px-2 py-0.5 text-sm rounded-full bg-slate-100 text-slate-500 border border-slate-200">
        —
      </span>
    );
  const today = new Date(todayStr());
  const d = new Date(date);
  const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  let classes = "bg-sky-100 text-sky-800 border-sky-200";
  if (status !== "done" && diffDays < 0) classes = "bg-red-100 text-red-800 border-red-200";
  else if (status !== "done" && diffDays <= 2) classes = "bg-amber-100 text-amber-800 border-amber-200";
  return (
    <span className={`inline-block px-2 py-0.5 text-sm rounded-full border font-semibold ${classes}`}>{date}</span>
  );
}
