import React, { useMemo } from 'react';
import { Copy as CopyIcon, Trash2, ChevronDown } from 'lucide-react';
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
  onDuplicateMilestone,
  onDeleteMilestone,
  onAddLink,
  onRemoveLink,
}) {
  const statusOrder = { todo: 0, inprogress: 1, done: 2 };

  const { done, pct, tasksSorted } = useMemo(() => {
    const done = tasks.filter((t) => t.status === 'done').length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const tasksSorted = [...tasks].sort(
      (a, b) =>
        statusOrder[a.status] - statusOrder[b.status] || a.order - b.order,
    );
    return { done, pct, tasksSorted };
  }, [tasks]);

  return (
    <details className="group rounded-xl border border-black/10 bg-white">
      <summary className="cursor-pointer select-none p-4 flex items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2 flex-1">
          <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
          <div className="flex-1">
            <div className="font-semibold">{milestone.title}</div>
            <div className="h-2 bg-black/10 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-black/40" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onDuplicateMilestone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateMilestone(milestone.id);
              }}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Duplicate Milestone"
            >
              <CopyIcon size={16} />
            </button>
          )}
          {onDeleteMilestone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteMilestone(milestone.id);
              }}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Remove Milestone"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </summary>
      <div className="p-4 flex flex-col gap-2">
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

