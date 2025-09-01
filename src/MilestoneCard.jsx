import React from 'react';
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
  return (
    <details className="rounded-xl border border-black/10 bg-white p-4 flex flex-col md:flex-row">
      <summary className="cursor-pointer font-semibold">
        {milestone.title}
      </summary>
      <div className="mt-2 flex flex-col gap-2 flex-1">
        {milestone.goal && (
          <p className="text-sm text-black/60 mb-2">{milestone.goal}</p>
        )}
        <div className="flex flex-col gap-2">
          {tasks.map((t) => (
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
