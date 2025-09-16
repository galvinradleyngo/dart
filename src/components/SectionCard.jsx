import React from 'react';

export default function SectionCard({ title, actions, children, className = '' }) {
  return (
    <section
      className={`-mx-4 sm:mx-0 glass-surface ${className}`}
    >
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {actions}
      </div>
      <div className="pb-4 sm:px-6">{children}</div>
    </section>
  );
}
