import React, { useMemo } from "react";

export default function TaskChecklist({ tasks, team, milestones, onUpdate, onEdit }) {
  const today = new Date();
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
            <li key={date} className="rounded-xl border border-black/10 bg-white p-3 w-full">
              <div className="text-sm font-medium mb-1">
                {date === "none" ? "No due date" : formatDate(date)}
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
                        aria-label={`${t.title} for ${milestone ? milestone.title : "Unassigned"}`}
                        checked={t.status === "done"}
                        onChange={(e) => onUpdate(t.id, { status: e.target.checked ? "done" : "todo" })}
                      />
                      <button
                        onClick={() => onEdit(t.id)}
                        className="truncate text-left flex-1"
                        title={`${t.title}${milestone ? ` – ${milestone.title}` : " – Unassigned"}`}
                      >
                        {t.title} {" "}
                        <span className="text-black/60">
                          for {milestone ? milestone.title : "Unassigned"} — {assignee ? assignee.name : "Unassigned"}
                        </span>
                      </button>
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
          <ul className="space-y-1">
            {doneTasks.map((t) => {
              const milestone = milestones.find((m) => m.id === t.milestoneId);
              const assignee = team.find((m) => m.id === t.assigneeId);
              return (
                <li
                  key={t.id}
                  className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-900"
                >
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      className="rounded border-emerald-300"
                      aria-label={`${t.title} for ${milestone ? milestone.title : "Unassigned"}`}
                      checked
                      onChange={(e) => onUpdate(t.id, { status: e.target.checked ? "done" : "todo" })}
                    />
                    <button
                      onClick={() => onEdit(t.id)}
                      className="truncate text-left flex-1"
                      title={`${t.title}${milestone ? ` – ${milestone.title}` : " – Unassigned"}`}
                    >
                      {t.title} {" "}
                      <span className="text-emerald-700">
                        for {milestone ? milestone.title : "Unassigned"} — {assignee ? assignee.name : "Unassigned"}
                      </span>
                    </button>
                  </div>
                  <span className="text-xs text-emerald-700 ml-auto">
                    Completed: {t.completedDate ? formatDate(t.completedDate) : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
