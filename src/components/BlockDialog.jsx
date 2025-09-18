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
  const [showTagPicker, setShowTagPicker] = useState(false);
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
  const sharedFieldClasses =
    "w-full rounded-2xl border border-white/60 bg-white/55 px-3.5 py-2.5 text-sm text-slate-800 shadow-[0_18px_32px_-20px_rgba(15,23,42,0.4)] backdrop-blur placeholder:text-slate-500/70 focus:outline-none focus:ring-2";
  const reportFieldFocus = "focus:ring-indigo-200/70 focus:border-indigo-300";
  const resolveFieldFocus = "focus:ring-emerald-200/70 focus:border-emerald-300";

  useEffect(() => {
    if (!open) return;
    setShowTagPicker(false);
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
  const taggedMembersList = useMemo(
    () => taggedIds.map((id) => teamLookup.get(id)).filter(Boolean),
    [taggedIds, teamLookup]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 py-10 backdrop-blur-sm backdrop-saturate-150 sm:items-center sm:py-6"
      onClick={() => onCancel?.()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-dialog-title"
        className="w-full max-w-xl glass-surface overflow-hidden rounded-[28px] shadow-[0_38px_90px_-42px_rgba(15,23,42,0.58)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2
                id="block-dialog-title"
                className="text-lg font-semibold text-slate-900 drop-shadow-[0_10px_30px_rgba(15,23,42,0.18)]"
            >
              {isResolveMode ? "Resolve Block" : "Mark as Blocked"}
            </h2>
            {task && (
              <p className="text-sm text-slate-600/90">
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {isResolveMode ? (
            <div className="space-y-6 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-6 sm:space-y-0">
              <div className="space-y-4">
                <div className="glass-card border border-emerald-200/40 p-4 text-sm text-emerald-900/90">
                  <div className="text-sm font-semibold uppercase tracking-wide text-emerald-900/80">
                    Reported Block
                  </div>
                  <div className="mt-2 leading-relaxed text-emerald-900/80">
                    {block?.description || "No description provided."}
                  </div>
                  <div className="mt-3 text-xs font-medium uppercase tracking-wide text-emerald-900/70">
                    Reported by {reporterMember?.name || "Unknown"}
                    {block?.reportedAt ? ` on ${block.reportedAt}` : ""}
                  </div>
                  {taggedMembers.length > 0 && (
                    <div className="mt-1 text-xs text-emerald-900/70">
                      Tagged: {taggedMembers.join(", ")}
                    </div>
                  )}
                </div>
                {block?.resolvedAt && block?.resolution && (
                  <div className="glass-card border border-emerald-200/40 p-4 text-xs text-emerald-900/80">
                    <div className="text-sm font-semibold text-emerald-900/90">Previous Resolution</div>
                    <div className="mt-2 leading-relaxed">{block.resolution}</div>
                    <div className="mt-2 text-[11px] font-medium uppercase tracking-wide">
                      Resolved by {resolverMember?.name || "Unknown"}
                      {block.resolvedAt ? ` on ${block.resolvedAt}` : ""}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4 sm:mt-0">
                <div>
                  <label htmlFor="block-resolution" className="text-sm font-semibold text-slate-800/90">
                    Resolution notes
                  </label>
                  <textarea
                    id="block-resolution"
                    ref={resolutionRef}
                    value={resolution}
                    onChange={(event) => setResolution(event.target.value)}
                    rows={4}
                    className={`mt-2 ${sharedFieldClasses} ${resolveFieldFocus}`}
                    placeholder="How was this block resolved?"
                  />
                </div>
                <div>
                  <label htmlFor="block-resolver" className="text-sm font-semibold text-slate-800/90">
                    Resolved by
                  </label>
                  <select
                    id="block-resolver"
                    value={resolverId}
                    onChange={(event) => setResolverId(event.target.value)}
                    className={`mt-2 ${sharedFieldClasses} ${resolveFieldFocus}`}
                  >
                    <option value="">Select a resolver</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.roleType})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 sm:grid sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:gap-6 sm:space-y-0">
              <div className="space-y-4">
                <div>
                  <label htmlFor="block-description" className="text-sm font-semibold text-slate-800/90">
                    Block description
                  </label>
                  <textarea
                    id="block-description"
                    ref={descriptionRef}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    className={`mt-2 ${sharedFieldClasses} ${reportFieldFocus}`}
                    placeholder="What is blocking progress?"
                  />
                </div>
                <div>
                  <label htmlFor="block-reporter" className="text-sm font-semibold text-slate-800/90">
                    Reported by
                  </label>
                  <select
                    id="block-reporter"
                    value={reporterId}
                    onChange={(event) => setReporterId(event.target.value)}
                    className={`mt-2 ${sharedFieldClasses} ${reportFieldFocus}`}
                  >
                    <option value="">Select a reporter</option>
                    {team.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name} ({member.roleType})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-4 sm:mt-0">
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-800/90">Notify team members</div>
                  {team.length === 0 ? (
                    <p className="text-sm text-slate-500/80">No team members available.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="glass-card border border-indigo-200/35 bg-white/55 p-4 text-sm text-indigo-900/90">
                        <p>
                          Project managers are notified automatically.
                        </p>
                        {taggedMembersList.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {taggedMembersList.map((member) => (
                              <span
                                key={member.id}
                                className="rounded-full border border-white/60 bg-white/75 px-3 py-1 text-xs font-medium text-indigo-900/90 shadow-[0_10px_22px_-18px_rgba(15,23,42,0.45)]"
                              >
                                {member.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowTagPicker((prev) => !prev)}
                          className="mt-3 inline-flex items-center gap-2 rounded-full border border-indigo-200/60 bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 shadow-[0_12px_28px_-20px_rgba(79,70,229,0.55)] backdrop-blur transition hover:border-indigo-200 hover:text-indigo-700"
                        >
                          {showTagPicker ? "Hide list" : "Tag others"}
                        </button>
                      </div>
                      {showTagPicker && (
                        <ul className="glass-card grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                          {team.map((member) => (
                            <li key={member.id} className="min-w-0">
                              <label className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/45 px-3 py-2 text-sm text-slate-800 shadow-[0_18px_32px_-20px_rgba(15,23,42,0.35)] backdrop-blur">
                                <input
                                  type="checkbox"
                                  checked={taggedIds.includes(member.id)}
                                  onChange={() => toggleTagged(member.id)}
                                  className="h-4 w-4 rounded border-white/70 bg-white/70 text-indigo-500 focus:ring-indigo-400/80 focus:ring-offset-0"
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
                  )}
                </div>
              </div>
            </div>
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
    </div>
  );
}
