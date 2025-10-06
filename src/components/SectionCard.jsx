import React from 'react';

export default function SectionCard({ title, actions, children, className = '' }) {
  return (
    <section
      className={`-mx-4 sm:mx-0 glass-surface ${className}`}
    >
      <div className="section-header">
        <h2 className="section-title">{title}</h2>
        {actions}
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}
