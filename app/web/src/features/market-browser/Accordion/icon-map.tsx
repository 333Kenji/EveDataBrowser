// Lightweight inline SVG icon map for market categories & groups.
// Converted to .tsx because it exports JSX.

import React from 'react';

export type IconKey = 'ships' | 'blueprints' | 'drones' | 'implants' | 'minerals' | 'trade' | 'module' | 'skills' | 'default';

const baseProps = { width: 14, height: 14, viewBox: '0 0 24 24', 'aria-hidden': true } as const;

const ICONS: Record<IconKey, JSX.Element> = {
  ships: (
    <svg {...baseProps}><path fill="currentColor" d="M3 13h2l3 6h2l-1-6h4l-1 6h2l3-6h2l-2-3H5l-2 3Zm3.2-5h11.6L19 5H5l1.2 3Z"/></svg>
  ),
  blueprints: (
    <svg {...baseProps}><path fill="currentColor" d="M5 3h10l4 4v14a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm9 1.5V8h4L14 4.5ZM7 9h6v2H7V9Zm0 4h10v2H7v-2Zm0 4h10v2H7v-2Z"/></svg>
  ),
  drones: (
    <svg {...baseProps}><path fill="currentColor" d="M12 2 9.5 8h5L12 2Zm0 20 2.5-6h-5L12 22Zm10-10-6-2.5v5L22 12ZM2 12l6 2.5v-5L2 12Z"/></svg>
  ),
  implants: (
    <svg {...baseProps}><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v10a5 5 0 1 0 10 0V7a5 5 0 0 0-5-5Zm0 2a3 3 0 0 1 3 3v10a3 3 0 1 1-6 0V7a3 3 0 0 1 3-3Z"/></svg>
  ),
  minerals: (
    <svg {...baseProps}><path fill="currentColor" d="M12 2 4 7v10l8 5 8-5V7l-8-5Zm0 2.2 5.9 3.7L12 11.6 6.1 7.9 12 4.2ZM6 9.6l5 3v6.7l-5-3V9.6Zm7 9.7v-6.7l5-3v6.7l-5 3Z"/></svg>
  ),
  trade: (
    <svg {...baseProps}><path fill="currentColor" d="M4 4h6v6H4V4Zm0 10h6v6H4v-6Zm10-10h6v6h-6V4Zm0 10h6v6h-6v-6Z"/></svg>
  ),
  module: (
    <svg {...baseProps}><path fill="currentColor" d="M12 4 4 8v8l8 4 8-4V8l-8-4Zm0 2.1 5.5 2.7L12 11.5 6.5 8.8 12 6.1ZM6 10.6l5 2.4v5.3l-5-2.5v-5.2Zm7 7.7v-5.3l5-2.4v5.2l-5 2.5Z"/></svg>
  ),
  skills: (
    <svg {...baseProps}><path fill="currentColor" d="M6 3h12l1 3H5l1-3Zm-2 5h16v11l-8 3-8-3V8Zm8 2-6 2.2v1.7L12 14l6-2.1v-1.7L12 10Zm0 5-6-2.1v1.7L12 17l6-2.2v-1.7L12 15Z"/></svg>
  ),
  default: (
    <svg {...baseProps}><circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" strokeWidth="2"/><path fill="currentColor" d="M11 6h2v6h-2V6Zm0 8h2v2h-2v-2Z"/></svg>
  ),
};

export function getCategoryIcon(label: string): JSX.Element {
  const l = label.toLowerCase();
  if (l.includes('ship sk')) return ICONS.ships; // skins vs ships nuance
  if (l.includes('ship')) return ICONS.ships;
  if (l.includes('blueprint')) return ICONS.blueprints;
  if (l.includes('drone')) return ICONS.drones;
  if (l.includes('implant') || l.includes('booster')) return ICONS.implants;
  if (l.includes('skill')) return ICONS.skills;
  if (l.includes('mineral') || l.includes('ore')) return ICONS.minerals;
  if (l.includes('trade')) return ICONS.trade;
  if (l.includes('module')) return ICONS.module;
  return ICONS.default;
}
