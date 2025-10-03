import React, { useMemo } from "react";
import { useCompletionConfetti } from "../hooks/use-completion-confetti.js";
import { getAssigneeIds } from "../utils.js";

const STATUS_LABELS = {
  todo: "To Do",
  inprogress: "In Progress",
  blocked: "Blocked",
  skip: "Skipped",
  done: "Done",
};

const STATUS_BADGE_TONES = {
  todo: "bg-slate-100/80 text-slate-600 border-white/60",
  inprogress: "bg-indigo-100/80 text-indigo-600 border-indigo-200/80",
  blocked: "bg-rose-100/80 text-rose-600 border-rose-200/80",
  skip: "bg-amber-100/80 text-amber-700 border-amber-200/80",
  done: "bg-emerald-100/80 text-emerald-700 border-emerald-200/80",
};

const DEFAULT_STATUS_BADGE = "bg-slate-100/80 text-slate-600 border-white/60";

export default function TaskChecklist({ tasks, team, milestones, onUpdate, onEdit, statusPriority = null }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = today.toDateString();
  const { fireOnDone } = useCompletionConfetti();
  const isTaskOverdue = (task) => {
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };
  const priorityRank = (task) => {
    if (!statusPriority) return 1;
    if (statusPriority === "overdue") {
      return isTaskOverdue(task) ? 0 : 1;
    }
    return task.status === statusPriority ? 0 : 1;
  };
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
    const groups = Object.entries(map).map(([date, items]) => {
      const sortedItems = [...items].sort((a, b) => {
        const pa = priorityRank(a);
        const pb = priorityRank(b);
        if (pa !== pb) return pa - pb;
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" });
      });
      const hasPriority = statusPriority ? sortedItems.some((item) => priorityRank(item) === 0) : false;
      return { date, items: sortedItems, hasPriority };
    });
    groups.sort((a, b) => {
      if (statusPriority && a.hasPriority !== b.hasPriority) {
        return a.hasPriority ? -1 : 1;
      }
      if (a.date === "none") return b.date === "none" ? 0 : 1;
      if (b.date === "none") return -1;
      return new Date(a.date) - new Date(b.date);
    });
    const doneTasks = completed.sort((a, b) => {
      if (a.completedDate && b.completedDate) {
        return new Date(b.completedDate) - new Date(a.completedDate);
      }
      if (a.completedDate) return -1;
      if (b.completedDate) return 1;
      return 0;
    });
    return { activeGroups: groups, doneTasks };
  }, [tasks, statusPriority, todayKey]);

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
          {activeGroups.map(({ date, items }) => (
            <li key={date} className="glass-card p-4 w-full space-y-3">
              <div className="text-sm font-semibold text-slate-700/90">
                {date === "none" ? "No due date" : formatDate(date)}
              </div>
              <ul className="space-y-2">
                {items.map((t) => {
                  const milestone = milestones.find((m) => m.id === t.milestoneId);
                  const assigneesForTask = getAssigneeIds(t)
                    .map((id) => team.find((m) => m.id === id) || null)
                    .filter(Boolean);
                  const assigneeLabel = assigneesForTask.length
                    ? assigneesForTask.map((member) => member.name).join(", ")
                    : "Unassigned";
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
                  const isPriority = statusPriority
                    ? statusPriority === "overdue"
                      ? isTaskOverdue(t)
                      : t.status === statusPriority
                    : false;
                  const priorityRing = isPriority
                    ? "ring-2 ring-indigo-200/70 ring-offset-1 ring-offset-white"
                    : "";
                  const statusBadgeClass = STATUS_BADGE_TONES[t.status] || DEFAULT_STATUS_BADGE;
                  return (
                    <li key={t.id}>
                      <div
                        className={`flex items-center gap-3 rounded-3xl border px-4 py-3 shadow-[0_18px_32px_-20px_rgba(15,23,42,0.45)] backdrop-blur transition-all ${containerTone} ${priorityRing}`}
                      >
                        <input
                          type="checkbox"
                          className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-300 text-emerald-500 focus:ring-2 focus:ring-emerald-300"
                          aria-label={`${t.title} for ${milestone ? milestone.title : "Unassigned"}`}
                          checked={t.status === "done"}
                          onChange={(e) => {
                            const nextStatus = e.target.checked ? "done" : "todo";
                            fireOnDone(t.status, nextStatus);
                            onUpdate(t.id, { status: nextStatus });
                          }}
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
                            for {milestone ? milestone.title : "Unassigned"} • {assigneeLabel}
                          </div>
                        </button>
                        <div className="flex flex-col items-end gap-1 text-[11px] font-semibold uppercase tracking-wide">
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 shadow-sm backdrop-blur ${statusBadgeClass}`}
                          >
                            {STATUS_LABELS[t.status] || "Unknown"}
                          </span>
                          <span
                            className={`shrink-0 rounded-full border px-2.5 py-1 shadow-sm backdrop-blur ${pillTone}`}
                          >
                            {pillLabel}
                          </span>
                        </div>
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
              const assigneesForTask = getAssigneeIds(t)
                .map((id) => team.find((m) => m.id === id) || null)
                .filter(Boolean);
              const assigneeLabel = assigneesForTask.length
                ? assigneesForTask.map((member) => member.name).join(", ")
                : "Unassigned";
              return (
                <li key={t.id}>
                  <div className="flex items-center gap-3 rounded-3xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-emerald-700 shadow-[0_18px_32px_-20px_rgba(15,23,42,0.45)] backdrop-blur">
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-emerald-300 text-emerald-600 focus:ring-2 focus:ring-emerald-300"
                      aria-label={`${t.title} for ${milestone ? milestone.title : "Unassigned"}`}
                      checked
                      onChange={(e) => {
                        const nextStatus = e.target.checked ? "done" : "todo";
                        fireOnDone(t.status, nextStatus);
                        onUpdate(t.id, { status: nextStatus });
                      }}
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
                        for {milestone ? milestone.title : "Unassigned"} • {assigneeLabel}
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
