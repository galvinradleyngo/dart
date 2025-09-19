import React, { useRef, useEffect, useState, useCallback } from "react";
import InlineText from "./InlineText.jsx";
import Avatar from "./Avatar.jsx";
import DocumentInput from "./DocumentInput.jsx";
import { LinkChips } from "./LinksEditor.jsx";
import DepPicker from "./DepPicker.jsx";
import DuePill from "./DuePill.jsx";
import { X } from "lucide-react";
import { useCompletionConfetti } from "../hooks/use-completion-confetti.js";
import BlockDialog from "./BlockDialog.jsx";

function statusBg(status) {
  if (status === "done") return "bg-emerald-50";
  if (status === "skip") return "bg-pink-50";
  if (status === "blocked") return "bg-orange-50";
  if (status === "inprogress") return "bg-amber-50";
  return "bg-sky-50";
}

export default function TaskModal({ task, courseId, courses, onChangeCourse, tasks, team, milestones, onUpdate, onDelete, onAddLink, onRemoveLink, onClose, reporter = null }) {
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { fireOnDone } = useCompletionConfetti();
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blockPrevStatus, setBlockPrevStatus] = useState(task?.status || "todo");

  useEffect(() => {
    if (task) {
      setOpen(true);
    }
  }, [task]);

  useEffect(() => {
    if (task?.status) {
      setBlockPrevStatus(task.status);
    }
  }, [task?.status]);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  useEffect(() => {
    if (!task) return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusable[0]?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Tab') {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [task, handleClose]);

  if (!task) return null;
  const assignee = team.find((m) => m.id === task.assigneeId);
  return (
    <div
      className={`fixed inset-0 bg-black/40 flex items-center justify-center z-50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        className={`bg-white rounded-xl p-4 w-full max-w-lg max-h-[90vh] overflow-y-auto transform transition-all duration-200 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold">
              <InlineText value={task.title} onChange={(v) => onUpdate(task.id, { title: v })} />
            </div>
            <div className="text-sm text-black/60">
              <InlineText
                value={task.details}
                onChange={(v) => onUpdate(task.id, { details: v })}
                placeholder="Details…"
                multiline
              />
            </div>
          </div>
          <button onClick={handleClose} aria-label="Close">
            <X className="icon text-slate-500 hover:text-black" />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          {courses && onChangeCourse && (
            <select
              value={courseId}
              onChange={(e) => onChangeCourse(e.target.value)}
            >
              {courses.map((c) => (
                <option key={c.course.id} value={c.course.id}>
                  {c.course.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={task.milestoneId ?? ""}
            onChange={(e) => onUpdate(task.id, { milestoneId: e.target.value || null })}
          >
            <option value="">Unassigned</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            {assignee ? (
              <Avatar name={assignee.name} roleType={assignee.roleType} avatar={assignee.avatar} />
            ) : (
              <span className="text-black/40">—</span>
            )}
            <select
              value={task.assigneeId || ""}
              onChange={(e) => onUpdate(task.id, { assigneeId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.roleType})
                </option>
              ))}
            </select>
          </div>
          <select
            value={task.status}
            onChange={(e) => {
              const nextStatus = e.target.value;
              if (nextStatus === "blocked") {
                setBlockPrevStatus(task.status);
                setBlockDialogOpen(true);
                return;
              }
              fireOnDone(task.status, nextStatus);
              onUpdate(task.id, { status: nextStatus });
            }}
            className={statusBg(task.status)}
          >
            <option value="todo">To Do</option>
            <option value="inprogress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="skip">Skipped</option>
          </select>
          <div className="flex items-center gap-2">
            <span>Start</span>
            <input
              type="date"
              value={task.startDate || ""}
              onChange={(e) => {
                const patch = { startDate: e.target.value };
                if (task.status === 'todo') patch.status = 'inprogress';
                onUpdate(task.id, patch);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span># of Workdays</span>
            <input
              type="number"
              min={0}
              value={task.workDays ?? 0}
              onChange={(e) => onUpdate(task.id, { workDays: Number(e.target.value) })}
              className="w-20"
            />
          </div>
          <div className="basis-full w-full">
            <DocumentInput onAdd={(url) => onAddLink(task.id, url)} />
            {task.links && task.links.length > 0 && (
              <LinkChips links={task.links} onRemove={(i) => onRemoveLink(task.id, i)} />
            )}
          </div>
          <div className="basis-full text-sm text-slate-700">
            <span className="font-medium mr-1">Note:</span>
            <InlineText
              value={task.note}
              onChange={(v) => onUpdate(task.id, { note: v })}
              placeholder="Add a quick note…"
              multiline
            />
          </div>
          <DepPicker task={task} tasks={tasks} onUpdate={onUpdate} />
          <div className="ml-auto flex items-center gap-2">
            <DuePill date={task.dueDate} status={task.status} />
            {task.status === "done" && (
              <span className="text-slate-500">Completed: {task.completedDate || "—"}</span>
            )}
          </div>
        </div>
        {onDelete && (
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                onDelete(task.id);
                handleClose();
              }}
              className="text-rose-600 hover:text-rose-700 text-sm"
            >
              Delete
            </button>
          </div>
        )}
        <BlockDialog
          open={blockDialogOpen}
          task={task}
          team={team}
          reporter={reporter}
          onSubmit={(entry) => {
            setBlockDialogOpen(false);
            fireOnDone(blockPrevStatus, "blocked");
            const blocks = Array.isArray(task.blocks) ? task.blocks : [];
            onUpdate(task.id, { status: "blocked", blocks: [...blocks, entry] });
          }}
          onCancel={() => {
            setBlockDialogOpen(false);
          }}
        />
      </div>
    </div>
  );
}
