/**
 * ShipCard.tsx
 * Minimal ship detail wrapper consuming ShipCard contract. Future work will
 * style the tabs, embed the 3D viewer, and add lore panels.
 */

import React from 'react';
import { Tabs } from '../ui/Tabs';

export interface ShipCardData {
  type_id: number;
  name: string;
  description: string;
  race_id: number;
  faction: string;
  group: { id: number; name: string };
  slots: { high: number; med: number; low: number; rig_slots: number; rig_size: string };
  hardpoints: { launcher: number; turret: number };
  attributes: {
    mass: number;
    volume: number;
    capacity: number;
    align_time: number;
    cpu: number;
    powergrid: number;
  };
  manifest: { version: string; imported_at: string };
}

interface ShipCardProps {
  ship: ShipCardData;
  enable3D?: boolean;
}

const FEATURE_SHIP_3D = typeof window !== 'undefined' && (window as any).FEATURE_SHIP_3D !== 'false';

export const ShipCard: React.FC<ShipCardProps> = ({ ship, enable3D = FEATURE_SHIP_3D }) => {
  const tabs = [
    { id: 'stats', label: 'Stats' },
    { id: 'slots', label: 'Slots' },
    { id: 'description', label: 'Description' },
    { id: 'attributes', label: 'Attributes' }
  ];
  const [activeTab, setActiveTab] = React.useState<string>(tabs[0].id);

  return (
    <section aria-labelledby="ship-card-heading" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h2 id="ship-card-heading">{ship.name}</h2>
        <p style={{ opacity: 0.7 }}>#{ship.type_id} · {ship.group.name} · {ship.faction}</p>
      </header>
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: '0 0 320px', minHeight: 240, borderRadius: 24, background: 'rgba(255,255,255,0.04)' }}>
          {enable3D ? (
            <div style={{ padding: 16 }}>3D viewer placeholder</div>
          ) : (
            <div style={{ padding: 16 }}>Static ship image placeholder</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <Tabs tabs={tabs} activeId={activeTab} onChange={setActiveTab} />
          {activeTab === 'stats' && (
            <div>
              <p>Mass: {ship.attributes.mass}</p>
              <p>Volume: {ship.attributes.volume}</p>
              <p>Capacity: {ship.attributes.capacity}</p>
            </div>
          )}
          {activeTab === 'slots' && (
            <div>
              <p>High: {ship.slots.high}</p>
              <p>Medium: {ship.slots.med}</p>
              <p>Low: {ship.slots.low}</p>
              <p>Rig Slots: {ship.slots.rig_slots} · {ship.slots.rig_size}</p>
              <p>Hardpoints — Launcher: {ship.hardpoints.launcher}, Turret: {ship.hardpoints.turret}</p>
            </div>
          )}
          {activeTab === 'description' && <p>{ship.description}</p>}
          {activeTab === 'attributes' && (
            <div>
              <p>Align Time: {ship.attributes.align_time}s</p>
              <p>CPU: {ship.attributes.cpu}</p>
              <p>Powergrid: {ship.attributes.powergrid}</p>
            </div>
          )}
        </div>
      </div>
      <footer style={{ marginTop: 24, opacity: 0.6 }}>
        Manifest v{ship.manifest.version} · Imported {ship.manifest.imported_at}
      </footer>
    </section>
  );
};

export default ShipCard;
