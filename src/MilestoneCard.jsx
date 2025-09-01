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
  const order = { todo: 0, inprogress: 1, done: 2 };

  const { done, pct, tasksSorted } = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done').length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const tasksSorted = [...tasks].sort(
      (a, b) => order[a.status] - order[b.status] || a.order - b.order,
    );
    return { done, pct, tasksSorted };
  }, [tasks]);

  return (
    <details className="rounded-xl border border-black/10 bg-white flex flex-col md:flex-row">
      <summary className="cursor-pointer select-none p-4 flex-1">
        <div className="font-semibold">{milestone.title}</div>
        <div className="h-2 bg-black/10 rounded-full mt-2 overflow-hidden">
          <div className="h-full bg-black/40" style={{ width: `${pct}%` }} />
        </div>
      </summary>
      <div className="p-4 flex flex-col gap-2 flex-1">
        {milestone.goal && (
          <p className="text-sm text-black/60 mb-2">{milestone.goal}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
