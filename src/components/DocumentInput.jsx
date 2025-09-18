import React, { useState } from "react";
import { Plus } from "lucide-react";
import { normalizeUrl } from "../utils.js";

export default function DocumentInput({ onAdd }) {
  const [val, setVal] = useState("");
  const add = () => {
    const url = val.trim();
    if (!url) return;
    const normalized = normalizeUrl(url);
    if (!normalized) return;
    onAdd?.(normalized);
    setVal("");
  };
  return (
    <div className="flex items-center gap-2 text-sm w-full">
      <label htmlFor="document-url" className="font-medium">
        Document:
      </label>
      <input
        id="document-url"
        type="text"
        inputMode="url"
        autoComplete="url"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
        }}
        placeholder="Paste link and press Enter"
        className="w-48"
      />
      <button
        onClick={add}
        className="px-2 py-1 rounded border border-black/10 bg-white hover:bg-slate-50"
        aria-label="Add document"
      >
        <Plus className="icon" />
      </button>
    </div>
  );
}
