/**
 * Tabs.tsx
 * Minimal controlled tabs component. Enhancements will add focus outlines,
 * motion tokens, and panel management per style guide.
 */

import React, { KeyboardEvent } from 'react';

export interface TabDefinition {
  id: string;
  label: string;
}

export interface TabsProps {
  tabs: TabDefinition[];
  activeId: string;
  onChange: (id: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeId, onChange }) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeId);
    if (currentIndex === -1) {
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = tabs[(currentIndex + 1) % tabs.length];
      onChange(next.id);
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
      onChange(prev.id);
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      style={{ display: 'flex', gap: 8, marginBottom: 16 }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              border: 'none',
              background: isActive ? 'rgba(34,211,238,0.16)' : 'transparent',
              color: '#e6e9ff',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
