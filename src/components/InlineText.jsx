import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function InlineText({ value, onChange, className = "", placeholder = "Untitled", multiline = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange?.(draft);
  };
  return (
    <AnimatePresence initial={false} mode="wait">
      {!editing ? (
        <motion.span
          key="view"
          className={`cursor-text hover:bg-black/5 rounded px-1 ${className}`}
          onClick={() => setEditing(true)}
          title="Click to edit"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {value?.trim() ? value : <span className="text-black/40">{placeholder}</span>}
        </motion.span>
      ) : multiline ? (
        <motion.textarea
          key="edit"
          autoFocus
          className={`w-full rounded border border-black/10 bg-white px-2 py-1 outline-none ${className}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
        />
      ) : (
        <motion.input
          key="edit"
          autoFocus
          className={`w-full rounded border border-black/10 bg-white px-2 py-1 outline-none ${className}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(value ?? "");
              setEditing(false);
            }
          }}
        />
      )}
    </AnimatePresence>
  );
}
