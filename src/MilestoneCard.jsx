import React, { useMemo, useState, useEffect, useRef } from 'react';
import TaskCard from './TaskCard.jsx';
import { Copy, Save, Trash, ChevronDown, Plus } from 'lucide-react';

export default function MilestoneCard({
  milestone,
  tasks = [],
  tasksAll = [],
  team = [],
  milestones = [],
  taskSort = 'numeric',
  onTaskSortChange = () => {},
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
    const toTimestamp = (task) => {
      const value = task?.dueDate;
      if (!value) return null;
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
      if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
      }
      if (value && typeof value.toMillis === 'function') {
        const millis = value.toMillis();
        return Number.isFinite(millis) ? millis : null;
      }
      if (value && typeof value.toDate === 'function') {
        const date = value.toDate();
        if (date instanceof Date && !Number.isNaN(date.getTime())) return date.getTime();
      }
      if (value && typeof value.seconds === 'number') {
        return value.seconds * 1000;
      }
      return null;
    };
    const compareTitle = (a, b) =>
      (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' });
    const compareStatus = (a, b) =>
      (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99) ||
      (a.order ?? 0) - (b.order ?? 0);
    const extractNumeric = (task) => {
      const match = (task?.title ?? '').match(/\d+/);
      if (!match) return null;
      const [raw] = match;
      const normalized = raw.replace(/^0+/, '') || '0';
      const value = Number.parseInt(normalized, 10);
      if (!Number.isFinite(value)) return null;
      return {
        length: normalized.length,
        value,
        index: match.index ?? 0,
      };
    };
    const compareNumeric = (a, b) => {
      const aNum = extractNumeric(a);
      const bNum = extractNumeric(b);
      if (aNum && bNum) {
        if (aNum.length !== bNum.length) return aNum.length - bNum.length;
        if (aNum.value !== bNum.value) return aNum.value - bNum.value;
        if (aNum.index !== bNum.index) return aNum.index - bNum.index;
        return compareStatus(a, b) || compareTitle(a, b);
      }
      if (aNum) return -1;
      if (bNum) return 1;
      return compareStatus(a, b) || compareTitle(a, b);
    };
    const now = Date.now();
    const compareDeadline = (a, b) => {
      const aTs = toTimestamp(a);
      const bTs = toTimestamp(b);
      if (aTs === null && bTs === null) return compareTitle(a, b);
      if (aTs === null) return 1;
      if (bTs === null) return -1;
      const aDiff = Math.abs(aTs - now);
      const bDiff = Math.abs(bTs - now);
      if (aDiff !== bDiff) return aDiff - bDiff;
      if (aTs !== bTs) return aTs - bTs;
      return compareTitle(a, b);
    };
    const sorter = taskSort === 'deadline'
      ? compareDeadline
      : taskSort === 'title'
        ? (a, b) => compareTitle(a, b) || compareStatus(a, b)
        : taskSort === 'status'
          ? (a, b) => compareStatus(a, b) || compareTitle(a, b)
          : compareNumeric;
    const tasksSorted = [...tasks].sort(sorter);
    return { pct, tasksSorted };
  }, [tasks, taskSort]);

  const progressColor = `hsl(${210 + (pct / 100) * (140 - 210)}, 70%, 50%)`;

  const handleTaskSortChange = (event) => {
    onTaskSortChange(event.target.value);
  };

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
      <div className="p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          {milestone.goal && (
            <p className="text-sm text-black/60 max-w-xl">{milestone.goal}</p>
          )}
          <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <span className="hidden sm:inline text-xs uppercase tracking-wide text-slate-500">
              Sort by
            </span>
            <select
              value={taskSort}
              onChange={handleTaskSortChange}
              className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
              aria-label="Sort tasks within milestones"
            >
              <option value="numeric">1–N</option>
              <option value="status">Status</option>
              <option value="title">A–Z</option>
              <option value="deadline">Deadline</option>
            </select>
          </label>
        </div>
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
