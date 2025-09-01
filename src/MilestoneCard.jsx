import React, { useMemo } from 'react';
import TaskCard from './TaskCard.jsx';

export default function MilestoneCard({
  milestone,
  tasks = [],
  tasksAll = [],
  team = [],
  milestones = [],
  onUpdate,
  onDelete,
  onDuplicate,
  onAddLink,
  onRemoveLink,
}) {
  const done = tasks.filter((t) => t.status === 'done').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const tasksSorted = useMemo(() => {
    const order = { todo: 0, inprogress: 1, done: 2 };
    return [...tasks].sort(
      (a, b) => order[a.status] - order[b.status] || (a.order ?? 0) - (b.order ?? 0)
    );
  }, [tasks]);
  return (
    <details className="rounded-xl border border-black/10 bg-white p-4">
      <summary className="cursor-pointer flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{milestone.title}</span>
          <span className="text-xs text-black/60">{pct}%</span>
        </div>
        <div className="h-2 w-full bg-slate-200 rounded-full">
          <div
            className="h-full bg-emerald-500 rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
      </summary>
      <div className="mt-3 flex flex-col md:flex-row gap-4">
        {milestone.goal && (
          <p className="text-sm text-black/60 md:w-1/3">{milestone.goal}</p>
        )}
        <div className="flex-1 grid gap-2 md:grid-cols-2">
          {tasksSorted.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              tasks={tasksAll}
              team={team}
              milestones={milestones}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onAddLink={onAddLink}
              onRemoveLink={onRemoveLink}
            />
          ))}
        </div>
      </div>
    </details>
  );
}
