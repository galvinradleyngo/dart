import React, { useState } from "react";
import { Link2 } from "lucide-react";

export function LinksEditor({ links = [], onAdd, onRemove }) {
  const [val, setVal] = useState("");
  const add = () => {
    const url = val.trim();
    if (!url) return;
    try {
      const u = new URL(url);
      onAdd?.(u.toString());
      setVal("");
    } catch {}
  };
  return (
    <div className="mt-1">
      <div className="flex flex-wrap gap-1 mb-1">
        {links.map((l, i) => (
          <a
            key={i}
            href={l}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm border border-black/10 bg-white hover:bg-slate-50"
          >
            <Link2 size={12} />
            {(() => {
              try {
                return new URL(l).hostname;
              } catch {
                return l;
              }
            })()}
            <button
              type="button"
              className="ml-1 text-slate-400 hover:text-rose-600"
              onClick={(e) => {
                e.preventDefault();
                onRemove?.(i);
              }}
              aria-label="Remove link"
            >
              ×
            </button>
          </a>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Paste link & press Enter"
          className="w-full border rounded px-2 py-1 text-sm"
        />
        <button
          onClick={add}
          className="px-2 py-1 text-sm rounded border border-black/10 bg-white hover:bg-slate-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function LinkChips({ links = [], onRemove }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {links.map((l, i) => (
        <a
          key={i}
          href={l}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border border-black/10 bg-white hover:bg-slate-50"
        >
          <Link2 size={12} />
          {(() => {
            try {
              return new URL(l).hostname;
            } catch {
              return l;
            }
          })()}
          <button
            type="button"
            className="ml-1 text-slate-400 hover:text-rose-600"
            onClick={(e) => {
              e.preventDefault();
              onRemove?.(i);
            }}
            aria-label="Remove link"
          >
            ×
          </button>
        </a>
      ))}
    </div>
  );
}
