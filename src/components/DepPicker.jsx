import React, { useState } from "react";
import { GitBranch } from "lucide-react";

export default function DepPicker({ task, tasks, onUpdate }) {
  const [open, setOpen] = useState(false);
  const peers = tasks.filter((x) => x.milestoneId === task.milestoneId && x.id !== task.id);
  const current = peers.find((p) => p.id === task.depTaskId);
  return (
    <div className="text-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50"
        aria-label="Toggle dependency picker"
      >
        <GitBranch size={12} /> {current ? `Depends on: ${current.title}` : "Add dependency"}
      </button>
      {open && (
        <div className="mt-1">
          <select
            value={task.depTaskId || ""}
            onChange={(e) => {
              const val = e.target.value || null;
              onUpdate(task.id, { depTaskId: val });
              setOpen(false);
            }}
            className="border rounded px-2 py-1"
          >
            <option value="">— none —</option>
            {peers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
