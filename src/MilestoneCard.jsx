import React, { useMemo, useState, useEffect, useRef } from 'react';
import TaskCard from './TaskCard.jsx';
import { Copy, Save, Trash, ChevronDown, Plus } from 'lucide-react';

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
  onUpdateMilestone,
  onSaveAsTemplate,
  onAddTask,
  reporter = null,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(milestone.title);
  const detailsRef = useRef(null);

  useEffect(() => setTitleDraft(milestone.title), [milestone.title]);

  const commitTitle = () => {
    setEditingTitle(false);
    if (titleDraft !== milestone.title) {
      onUpdateMilestone?.(milestone.id, { title: titleDraft });
    }
  };

  const statusOrder = { todo: 0, inprogress: 1, blocked: 2, done: 3, skip: 4 };

  const { pct, tasksSorted } = useMemo(() => {
    const completedCount = tasks.filter((t) => t.status === 'done' || t.status === 'skip').length;
    const pct = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;
    const tasksSorted = [...tasks].sort(
      (a, b) =>
        (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99) ||
        a.order - b.order,
    );
    return { pct, tasksSorted };
  }, [tasks]);

  const progressColor = `hsl(${210 + (pct / 100) * (140 - 210)}, 70%, 50%)`;

  const triggerAddTask = () => {
    if (detailsRef.current) {
      detailsRef.current.open = true;
    }
    onAddTask?.(milestone.id);
  };

  const handleAddTaskFromSummary = (event) => {
    event.preventDefault();
    event.stopPropagation();
    triggerAddTask();
  };

  return (
    <details ref={detailsRef} className="group rounded-xl border border-black/10 bg-white">
      <summary className="cursor-pointer select-none p-4 flex flex-wrap items-center justify-between gap-2 list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2 flex-1">
          <ChevronDown className="icon transition-transform group-open:rotate-180" />
          <div className="flex-1">
            {onUpdateMilestone ? (
              editingTitle ? (
                <input
                  autoFocus
                  className="w-full font-semibold rounded border border-black/10 px-1"
                  value={titleDraft}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTitle();
                    if (e.key === 'Escape') {
                      setTitleDraft(milestone.title);
                      setEditingTitle(false);
                    }
                  }}
                />
              ) : (
                <div
                  className="font-semibold cursor-text hover:bg-black/5 rounded px-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTitle(true);
                  }}
                >
                  {milestone.title}
                </div>
              )
            ) : (
              <div className="font-semibold">{milestone.title}</div>
            )}
            <div className="h-2 bg-black/10 rounded-full mt-2 overflow-hidden">
              <div
                data-testid="progress-fill"
                className="h-full"
                style={{ width: `${pct}%`, backgroundColor: progressColor }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {onAddTask && (
            <button
              type="button"
              onClick={handleAddTaskFromSummary}
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
              title="Add task"
              aria-label="Add task"
            >
              <Plus className="icon" />
            </button>
          )}
          {onDuplicateMilestone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateMilestone(milestone.id);
              }}
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Duplicate Milestone"
              aria-label="Duplicate Milestone"
              type="button"
            >
              <Copy className="icon" />
            </button>
          )}
          {onSaveAsTemplate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSaveAsTemplate(milestone.id);
              }}
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-black/10 bg-green-50 text-green-600 hover:bg-green-100"
              title="Save as Milestone Template"
              aria-label="Save as Milestone Template"
              type="button"
            >
              <Save className="icon" />
            </button>
          )}
          {onDeleteMilestone && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteMilestone(milestone.id);
              }}
              className="inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-black/10 bg-slate-100 text-slate-600 hover:bg-slate-200"
              title="Remove Milestone"
              aria-label="Remove Milestone"
              type="button"
            >
              <Trash className="icon" />
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
              reporter={reporter}
            />
          ))}
        </div>
        {onAddTask && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={triggerAddTask}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            >
              <Plus className="icon" />
              <span>Add Task</span>
            </button>
          </div>
        )}
      </div>
    </details>
  );
}
