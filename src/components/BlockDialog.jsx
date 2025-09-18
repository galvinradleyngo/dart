import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { uid, todayStr } from "../utils.js";

export default function BlockDialog({
  open,
  task,
  team = [],
  reporter = null,
  onSubmit,
  onCancel,
}) {
  const [description, setDescription] = useState("");
  const reporterIdDefault = reporter?.id || "";
  const [reporterId, setReporterId] = useState(reporterIdDefault);
  const defaultTagged = useMemo(
    () => team.filter((member) => member.roleType === "PM").map((member) => member.id),
    [team]
  );
  const [taggedIds, setTaggedIds] = useState(defaultTagged);
  const dialogRef = useRef(null);
  const descriptionRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setReporterId(reporterIdDefault);
    setTaggedIds(defaultTagged);
  }, [open, reporterIdDefault, defaultTagged]);

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    const desc = descriptionRef.current;
    desc?.focus();
    if (!el) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
      }
    };
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  const toggleTagged = (id) => {
    setTaggedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = description.trim();
    if (!trimmed || !reporterId) return;
    const taggedMemberIds = Array.from(new Set(taggedIds));
    const entry = {
      id: uid(),
      reportedAt: todayStr(),
      reportedBy: reporterId,
      description: trimmed,
      taggedMemberIds,
      resolvedAt: null,
      resolvedBy: null,
      resolution: "",
    };
    onSubmit?.(entry);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => onCancel?.()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-dialog-title"
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 id="block-dialog-title" className="text-base font-semibold text-slate-800">
              Mark as Blocked
            </h2>
            {task && (
              <p className="text-sm text-slate-600">
                {task.title || "Untitled task"}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onCancel?.()}
            className="glass-icon-button"
            aria-label="Close"
          >
            <X className="icon" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="block-description" className="text-sm font-medium text-slate-700">
              Block description
            </label>
            <textarea
              id="block-description"
              ref={descriptionRef}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              placeholder="What is blocking progress?"
            />
          </div>
          <div>
            <label htmlFor="block-reporter" className="text-sm font-medium text-slate-700">
              Reported by
            </label>
            <select
              id="block-reporter"
              value={reporterId}
              onChange={(event) => setReporterId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Select a reporter</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} ({member.roleType})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-700">Notify team members</div>
            {team.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">No team members available.</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {team.map((member) => (
                  <li key={member.id}>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={taggedIds.includes(member.id)}
                        onChange={() => toggleTagged(member.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="truncate">
                        {member.name} ({member.roleType})
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="glass-button"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="glass-button-primary"
              disabled={!description.trim() || !reporterId}
            >
              Add Block
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
