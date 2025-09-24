/**
 * BlueprintCard.tsx
 * Minimal blueprint detail skeleton. Future work will wire live calculator,
 * market chart visuals, and activity-specific interactions.
 */

import React from 'react';

export interface BlueprintMaterial {
  type_id: number;
  name: string;
  qty: number;
}

export interface BlueprintActivitiesPresent {
  manufacturing: boolean;
  research_me: boolean;
  research_te: boolean;
  invention: boolean;
}

export interface BlueprintManufacturingInfo {
  time: number;
  runs: number;
  materials: BlueprintMaterial[];
}

export interface BlueprintCardData {
  blueprint_type_id: number;
  name: string;
  product: { type_id: number; name: string };
  activities_present: BlueprintActivitiesPresent;
  manufacturing: BlueprintManufacturingInfo;
  invention?: {
    datacores: BlueprintMaterial[];
    base_chance: number;
  } | null;
  manifest: { version: string; imported_at: string };
}

export interface BlueprintCardProps {
  blueprint: BlueprintCardData;
}

const activityOrder: { key: keyof BlueprintActivitiesPresent; label: string }[] = [
  { key: 'manufacturing', label: 'Manufacturing' },
  { key: 'research_me', label: 'Research ME' },
  { key: 'research_te', label: 'Research TE' },
  { key: 'invention', label: 'Invention' }
];

export const BlueprintCard: React.FC<BlueprintCardProps> = ({ blueprint }) => {
  return (
    <section aria-labelledby="blueprint-card-heading" style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h2 id="blueprint-card-heading">{blueprint.name}</h2>
        <p style={{ opacity: 0.7 }}>Produces: {blueprint.product.name}</p>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
        <div style={{ borderRadius: 24, background: 'rgba(255,255,255,0.04)', padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Calculator</h3>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {activityOrder.map(({ key, label }) => (
              <button
                key={key}
                disabled={!blueprint.activities_present[key]}
                style={{
                  padding: '8px 12px',
                  borderRadius: 20,
                  border: 'none',
                  opacity: blueprint.activities_present[key] ? 1 : 0.3
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <ul>
            {blueprint.manufacturing.materials.map((material) => (
              <li key={material.type_id}>{material.name} × {material.qty}</li>
            ))}
          </ul>
          <p style={{ marginTop: 8 }}>Runs: {blueprint.manufacturing.runs} · Time: {blueprint.manufacturing.time}s</p>
        </div>
        <div style={{ borderRadius: 24, background: 'rgba(255,255,255,0.04)', padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>Market Stats</h3>
          <div style={{ height: 220, borderRadius: 16, background: 'rgba(34,211,238,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Blueprint market chart placeholder
          </div>
        </div>
      </div>
      <footer style={{ marginTop: 24, opacity: 0.6 }}>
        Manifest v{blueprint.manifest.version} · Imported {blueprint.manifest.imported_at}
      </footer>
    </section>
  );
};

export default BlueprintCard;
