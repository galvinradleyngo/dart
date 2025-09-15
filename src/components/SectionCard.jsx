import React from 'react';

export default function SectionCard({ title, actions, children, className = '' }) {
  return (
    <section
      className={`-mx-4 sm:mx-0 bg-white shadow-sm sm:rounded-xl sm:border border-black/10 ${className}`}
    >
      <div className="px-4 py-4 flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="pb-4 sm:px-4">{children}</div>
    </section>
  );
}
