import React from 'react';

export default function SectionCard({ title, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
