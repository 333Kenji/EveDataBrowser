# UI Style Guide — Eve Data Browser (Phase-1)

## Design Tokens
- **Color Palette**: reuse Eve-inspired dark base `#0a0f1c`, accent cyan `#22d3ee`, violet `#8b5cf6`, amber `#f59e0b`, surface gradient overlays (see CSS variables).
- **Spacing Scale**: 4px base → 4, 8, 12, 16, 24, 32, 48.
- **Border Radius**: `sm=4px`, `md=8px`, `lg=16px`, `2xl=24px` (card corners).
- **Shadows**: soft ambient `0 10px 40px rgba(10,15,28,0.35)`, inset glow for active states `0 0 0 1px rgba(34,211,238,0.35)`.
- **Typography**: Inter/Orbitron pairing; headings 20/24/32px, body 14/16px, monospace for technical readouts.

## Layout Components
- **SidebarRight**: docked right rail, 320px wide, hosts navigation (Ships, Blueprints), global actions (settings, reduced motion toggle), responsive collapse < 1024px.
- **GlobalSearch**: entity-agnostic input fixed to top of sidebar; displays grouped results (ships, blueprints) with keyboard navigation and manifest badge.
- **EntityCard Wrapper**: main content area; ensures consistent padding, background glow, and tab/ split layout handling.

## Ship Card
- Multi-tab layout (Stats, Fitting/Slots, Description, Attributes) with pill tabs across top.
- Upper-left: “floating” 3D viewport (react-three-fiber) within glassmorphic frame; fallback static image on feature flag off or `prefers-reduced-motion`.
- Info panels use iconography consistent with EVE “Show Info” (slot icons, bonus badges).

## Blueprint Card
- Split vertically: top “Calculator” (materials table, activity buttons row: Manufacturing, Research (ME/TE), Invention when available); bottom “MarketStats” chart panel.
- Chart mimics EVE market browser; highlight selected material trendline on hover.

## Background & Motion
- Filaments/nodes animated field rendered on canvas/layers; throttle via `requestAnimationFrame`, pause on hidden tab, obey `prefers-reduced-motion`.
- Depth/parallax overlay for holographic ambience; ensure CPU <3% on mid-range laptop.
- Feature flag `FEATURE_SHIP_3D` toggles 3D viewer; gracefully degrades to static card art.

## Accessibility
- Tabs use ARIA `tablist/tab` semantics; keyboard support (Left/Right/Enter), focus outlines.
- Provide textual description of ship model (screen-reader region) and fallback screenshot capture.
- Maintain WCAG AA contrast; allow user to disable animations.

## Implementation References
- React components live under `frontend/src/components/` (`SidebarRight`, `GlobalSearch`, `ResultList`, `cards/*`).
- Styling via CSS modules or Tailwind utilities; keep tokens centralized (e.g., `frontend/src/theme/tokens.ts`).
