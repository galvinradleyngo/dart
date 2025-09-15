import React from 'react';
import { Check, X } from "lucide-react";

export default function LinkReminderModal({ onOkay, onNoLink }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-4 w-full max-w-sm text-center space-y-4">
        <div className="text-lg">Please provide a link to the output</div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onOkay}
            className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50"
            aria-label="Okay"
          >
            <Check className="icon" />
          </button>
          <button
            onClick={onNoLink}
            className="px-4 py-2 rounded border border-slate-300 bg-white hover:bg-slate-50"
            aria-label="No link"
          >
            <X className="icon" />
          </button>
        </div>
      </div>
    </div>
  );
}
