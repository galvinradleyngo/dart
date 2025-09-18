import React, { useMemo } from "react";

export default function TaskChecklist({ tasks, team, milestones, onUpdate, onEdit }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toDateString();
  const { activeGroups, doneTasks } = useMemo(() => {
    const upcoming = [];
    const completed = [];
    for (const task of tasks) {
      if (task.status === "done") {
        completed.push(task);
      } else {
        upcoming.push(task);
      }
    }
    const map = upcoming.reduce((acc, t) => {
      const key = t.dueDate || "none";
      (acc[key] ||= []).push(t);
      return acc;
    }, {});
    const activeGroups = Object.entries(map).sort(([a], [b]) => {
      if (a === "none") return 1;
      if (b === "none") return -1;
      return new Date(a) - new Date(b);
    });
    const doneTasks = completed.sort((a, b) => {
      if (a.completedDate && b.completedDate) {
        return new Date(b.completedDate) - new Date(a.completedDate);
      }
      if (a.completedDate) return -1;
      if (b.completedDate) return 1;
      return 0;
    });
    return { activeGroups, doneTasks };
  }, [tasks]);

  const formatDate = (value) =>
    new Date(value).toLocaleDateString(undefined, {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    });

  return (
    <div className="space-y-6">
      {activeGroups.length > 0 && (
        <ul className="space-y-2">
          {activeGroups.map(([date, items]) => (
            <li key={date} className="glass-card p-4 w-full space-y-3">
              <div className="text-sm font-semibold text-slate-700/90">
                {date === "none" ? "No due date" : formatDate(date)}
              </div>
              <ul className="space-y-2">
                {items.map((t) => {
                  const milestone = milestones.find((m) => m.id === t.milestoneId);
                  const assignee = team.find((m) => m.id === t.assigneeId);
                  const dueDate = t.dueDate ? new Date(t.dueDate) : null;
                  const dueKey = dueDate ? dueDate.toDateString() : "";
                  const isOverdue = !!dueDate && dueDate < today;
                  const isDueToday = !!dueDate && dueKey === todayKey;
                  const containerTone = isOverdue
                    ? "border-red-200/80 bg-red-50/80 text-red-700/90"
                    : isDueToday
                    ? "border-amber-200/80 bg-amber-50/80 text-amber-700/90"
                    : "border-white/60 bg-white/80 text-slate-700";
                  const pillTone = isOverdue
                    ? "bg-red-100/80 text-red-700 border-red-200/80"
                    : isDueToday
                    ? "bg-amber-100/80 text-amber-700 border-amber-200/80"
                    : t.dueDate
                    ? "bg-white/80 text-slate-600 border-white/60"
                    : "bg-slate-100/80 text-slate-600 border-white/60";
                  const pillLabel = isOverdue
                    ? "Overdue"
                    : isDueToday
                    ? "Today"
                    : t.dueDate
                    ? "Scheduled"
                    : "No Date";
                  return (
                    <li key={t.id}>
                      <div
                        className={`flex items-center gap-3 rounded-3xl border px-4 py-3 shadow-[0_18px_32px_-20px_rgba(15,23,42,0.45)] backdrop-blur transition-all ${containerTone}`}
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 text-emerald-500 focus:ring-2 focus:ring-emerald-300"
                          aria-label={`${t.title} for ${milestone ? milestone.title : "Unassigned"}`}
                          checked={t.status === "done"}
                          onChange={(e) => onUpdate(t.id, { status: e.target.checked ? "done" : "todo" })}
                        />
                        <button
                          type="button"
                          onClick={() => onEdit(t.id)}
                          className="flex-1 min-w-0 text-left focus:outline-none"
                          title={`${t.title || "Untitled task"}${milestone ? ` – ${milestone.title}` : " – Unassigned"}`}
                        >
                          <div className="truncate text-[15px] font-medium leading-tight">
                            {t.title || "Untitled task"}
                          </div>
                          <div className="mt-0.5 truncate text-xs opacity-70">
                            for {milestone ? milestone.title : "Unassigned"} • {assignee ? assignee.name : "Unassigned"}
                          </div>
                        </button>
                        <span
                          className={`shrink-0 self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur ${pillTone}`}
                        >
                          {pillLabel}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {doneTasks.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-slate-600 mb-2">Completed Tasks</div>
          <ul className="space-y-2">
            {doneTasks.map((t) => {
              const milestone = milestones.find((m) => m.id === t.milestoneId);
              const assignee = team.find((m) => m.id === t.assigneeId);
              return (
                <li key={t.id}>
                  <div className="flex items-center gap-3 rounded-3xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-emerald-700 shadow-[0_18px_32px_-20px_rgba(15,23,42,0.45)] backdrop-blur">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-emerald-300 text-emerald-600 focus:ring-2 focus:ring-emerald-300"
                      aria-label={`${t.title} for ${milestone ? milestone.title : "Unassigned"}`}
                      checked
                      onChange={(e) => onUpdate(t.id, { status: e.target.checked ? "done" : "todo" })}
                    />
                    <button
                      type="button"
                      onClick={() => onEdit(t.id)}
                      className="flex-1 min-w-0 text-left focus:outline-none"
                      title={`${t.title || "Untitled task"}${milestone ? ` – ${milestone.title}` : " – Unassigned"}`}
                    >
                      <div className="truncate text-[15px] font-medium leading-tight">
                        {t.title || "Untitled task"}
                      </div>
                      <div className="mt-0.5 truncate text-xs opacity-70">
                        for {milestone ? milestone.title : "Unassigned"} • {assignee ? assignee.name : "Unassigned"}
                      </div>
                      <div className="mt-1 text-xs font-semibold opacity-80">
                        Completed: {t.completedDate ? formatDate(t.completedDate) : "—"}
                      </div>
                    </button>
                    <span className="shrink-0 self-start rounded-full border border-emerald-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 shadow-sm">
                      Done
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
