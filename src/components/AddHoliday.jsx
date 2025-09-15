import React, { useState } from "react";
import { Plus } from "lucide-react";

export default function AddHoliday({ onAdd }) {
  const [d, setD] = useState("");
  return (
    <div className="inline-flex items-center gap-1">
      <label htmlFor="holiday-date" className="sr-only">Holiday date</label>
      <input
        id="holiday-date"
        type="date"
        value={d}
        onChange={(e) => setD(e.target.value)}
      />
      <button
        onClick={() => {
          if (d) {
            onAdd(d);
            setD("");
          }
        }}
        className="px-2 py-1 text-sm rounded border border-black/10 bg-white hover:bg-slate-50"
        aria-label="Add holiday"
      >
        <Plus className="icon" />
      </button>
    </div>
  );
}
