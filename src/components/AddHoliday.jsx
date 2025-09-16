import React, { useState } from "react";
import { Plus } from "lucide-react";

export default function AddHoliday({ onAdd }) {
  const [d, setD] = useState("");
  return (
    <div className="inline-flex items-center gap-2">
      <label htmlFor="holiday-date" className="sr-only">Holiday date</label>
      <input
        id="holiday-date"
        type="date"
        value={d}
        onChange={(e) => setD(e.target.value)}
        className="rounded-2xl border border-white/60 bg-white/80 px-3 py-1.5 text-sm shadow-sm"
      />
      <button
        onClick={() => {
          if (d) {
            onAdd(d);
            setD("");
          }
        }}
        className="glass-button"
        aria-label="Add holiday"
      >
        <Plus className="icon" />
      </button>
    </div>
  );
}
