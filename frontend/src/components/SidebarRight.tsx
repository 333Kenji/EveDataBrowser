/**
 * SidebarRight.tsx
 * Minimal dockable sidebar with unified navigation. Future enhancements will add
 * global actions, hover tooltips, theming hooks, and persisted preferences.
 */

import React from 'react';

export type SidebarEntity = 'ships' | 'blueprints';

export interface SidebarRightProps {
  active: SidebarEntity;
  onSelect: (entity: SidebarEntity) => void;
}

const NAV_ITEMS: { id: SidebarEntity; label: string }[] = [
  { id: 'ships', label: 'Ships' },
  { id: 'blueprints', label: 'Blueprints' }
];

export const SidebarRight: React.FC<SidebarRightProps> = ({ active, onSelect }) => {
  return (
    <aside
      className="sidebar-right"
      role="navigation"
      aria-label="Entity navigation"
      style={{ width: 320, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
    >
      <div style={{ padding: '16px' }}>
        <input
          type="search"
          aria-label="Search ships and blueprints"
          placeholder="Search ships & blueprints"
          style={{ width: '100%', padding: '12px', borderRadius: 12 }}
        />
      </div>
      <nav role="tablist" aria-orientation="vertical" style={{ display: 'flex', flexDirection: 'column' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(item.id);
                }
              }}
              style={{
                padding: '12px 16px',
                margin: '0 16px 8px',
                borderRadius: 12,
                textAlign: 'left',
                border: 'none',
                background: isActive ? 'rgba(34,211,238,0.12)' : 'transparent',
                color: '#e6e9ff',
                cursor: 'pointer'
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default SidebarRight;
