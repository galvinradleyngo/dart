import React, { useMemo } from "react";

export default function TaskChecklist({ tasks, team, milestones, onUpdate, onEdit }) {
  const today = new Date();
  const groups = useMemo(() => {
    const map = tasks.reduce((acc, t) => {
      const key = t.dueDate || "none";
      (acc[key] ||= []).push(t);
      return acc;
    }, {});
    return Object.entries(map).sort(([a], [b]) => {
      if (a === "none") return 1;
      if (b === "none") return -1;
      return new Date(a) - new Date(b);
    });
  }, [tasks]);
  return (
    <ul className="space-y-2">
      {groups.map(([date, items]) => (
        <li key={date} className="rounded-xl border border-black/10 bg-white p-3 w-full">
          <div className="text-sm font-medium mb-1">
            {date === "none"
              ? "No due date"
              : new Date(date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                })}
          </div>
          <ul className="space-y-1">
            {items.map((t) => {
              const milestone = milestones.find((m) => m.id === t.milestoneId);
              const assignee = team.find((m) => m.id === t.assigneeId);
              const urgentClass =
                t.dueDate && new Date(t.dueDate) < today
                  ? "bg-rose-100 text-rose-800"
                  : t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString()
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100";
              return (
                <li
                  key={t.id}
                  className={`text-sm flex items-center gap-1 truncate w-full rounded px-2 py-1 ${urgentClass}`}
                >
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    aria-label={`${t.title} for ${milestone ? milestone.title : ""}`}
                    checked={t.status === "done"}
                    onChange={(e) => onUpdate(t.id, { status: e.target.checked ? "done" : "todo" })}
                  />
                  <button
                    onClick={() => onEdit(t.id)}
                    className="truncate text-left flex-1"
                    title={`${t.title}${milestone ? ` – ${milestone.title}` : ""}`}
                  >
                    {t.title} {" "}
                    <span className="text-black/60">
                      for {milestone ? milestone.title : "—"} — {assignee ? assignee.name : "Unassigned"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
