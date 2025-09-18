import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { uid, todayStr } from "../utils.js";

export default function BlockDialog({
  open,
  task,
  team = [],
  reporter = null,
  resolver = null,
  block = null,
  mode = "report",
  onSubmit,
  onResolve,
  onCancel,
}) {
  const isResolveMode = mode === "resolve";
  const [description, setDescription] = useState("");
  const reporterIdDefault = reporter?.id || "";
  const [reporterId, setReporterId] = useState(reporterIdDefault);
  const defaultTagged = useMemo(
    () =>
      isResolveMode
        ? Array.isArray(block?.taggedMemberIds)
          ? Array.from(new Set(block.taggedMemberIds.filter(Boolean)))
          : []
        : team
            .filter((member) => member.roleType === "PM")
            .map((member) => member.id),
    [team, isResolveMode, block?.taggedMemberIds]
  );
  const [taggedIds, setTaggedIds] = useState(defaultTagged);
  const [resolution, setResolution] = useState("");
  const resolverDefault = useMemo(() => {
    if (block?.resolvedBy) return block.resolvedBy;
    if (resolver?.id) return resolver.id;
    if (reporter?.id) return reporter.id;
    return team[0]?.id || "";
  }, [block?.resolvedBy, resolver?.id, reporter?.id, team]);
  const [resolverId, setResolverId] = useState(resolverDefault);
  const dialogRef = useRef(null);
  const descriptionRef = useRef(null);
  const resolutionRef = useRef(null);
  const teamLookup = useMemo(() => new Map(team.map((member) => [member.id, member])), [team]);

  useEffect(() => {
    if (!open) return;
    if (isResolveMode) {
      setResolution(block?.resolution ?? "");
      setResolverId(block?.resolvedBy ?? resolverDefault);
      setTaggedIds(defaultTagged);
    } else {
      setDescription("");
      setReporterId(reporterIdDefault);
      setTaggedIds(defaultTagged);
    }
  }, [
    open,
    isResolveMode,
    block?.resolution,
    block?.resolvedBy,
    reporterIdDefault,
    defaultTagged,
    resolverDefault,
  ]);

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    const target = isResolveMode ? resolutionRef.current : descriptionRef.current;
    target?.focus();
    if (!el) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel?.();
      }
    };
    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel, isResolveMode]);

  if (!open) return null;

  const toggleTagged = (id) => {
    setTaggedIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isResolveMode) {
      const trimmedResolution = resolution.trim();
      if (!trimmedResolution || !resolverId) return;
      onResolve?.({
        resolution: trimmedResolution,
        resolvedBy: resolverId,
        resolvedAt: todayStr(),
      });
    } else {
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
    }
  };

  const reporterMember = block?.reportedBy
    ? teamLookup.get(block.reportedBy) ?? null
    : reporter ?? null;
  const resolverMember = block?.resolvedBy
    ? teamLookup.get(block.resolvedBy) ?? null
    : resolver ?? null;
  const taggedMembers = Array.isArray(block?.taggedMemberIds)
    ? block.taggedMemberIds
        .map((id) => teamLookup.get(id))
        .filter(Boolean)
        .map((member) => member.name)
    : [];

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
              {isResolveMode ? "Resolve Block" : "Mark as Blocked"}
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
          {isResolveMode ? (
            <>
              <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-900">
                <div className="font-semibold">Reported Block</div>
                <div className="mt-1 text-emerald-900/80">
                  {block?.description || "No description provided."}
                </div>
                <div className="mt-2 text-xs text-emerald-900/70">
                  Reported by {reporterMember?.name || "Unknown"}
                  {block?.reportedAt ? ` on ${block.reportedAt}` : ""}
                </div>
                {taggedMembers.length > 0 && (
                  <div className="mt-1 text-xs text-emerald-900/70">
                    Tagged: {taggedMembers.join(", ")}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="block-resolution" className="text-sm font-medium text-slate-700">
                  Resolution notes
                </label>
                <textarea
                  id="block-resolution"
                  ref={resolutionRef}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  placeholder="How was this block resolved?"
                />
              </div>
              <div>
                <label htmlFor="block-resolver" className="text-sm font-medium text-slate-700">
                  Resolved by
                </label>
                <select
                  id="block-resolver"
                  value={resolverId}
                  onChange={(event) => setResolverId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm shadow-sm focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                >
                  <option value="">Select a resolver</option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.roleType})
                    </option>
                  ))}
                </select>
              </div>
              {block?.resolvedAt && block?.resolution && (
                <div className="rounded-lg border border-emerald-100 bg-white/70 p-3 text-xs text-emerald-800">
                  <div className="font-medium">Previous Resolution</div>
                  <div className="mt-1">{block.resolution}</div>
                  <div className="mt-1">
                    Resolved by {resolverMember?.name || "Unknown"}
                    {block.resolvedAt ? ` on ${block.resolvedAt}` : ""}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
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
            </>
          )}
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
              className={isResolveMode ? "glass-button-success" : "glass-button-primary"}
              disabled={
                isResolveMode
                  ? !resolution.trim() || !resolverId
                  : !description.trim() || !reporterId
              }
            >
              {isResolveMode ? "Resolve Block" : "Add Block"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
