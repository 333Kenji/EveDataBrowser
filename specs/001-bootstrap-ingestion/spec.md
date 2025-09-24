# Feature Specification: CCP SDE ingestion bootstrap

**Feature Branch**: `[001-bootstrap-ingestion]`  
**Created**: 2025-09-23  
**Status**: Draft  
**Input**: User description: "Load Eve SDE ZIP archives, persist them for browsing, and stand up the shared Docker baseline with manifest rotation."

## Execution Flow (main)
```
1. Parse user description from Input
   → If empty: ERROR "No feature description provided"
2. Extract key concepts from description
   → Identify: actors, actions, data, constraints, SDE touchpoints, manifest expectations, filament UI elements
3. For each unclear aspect:
   → Mark with [NEEDS CLARIFICATION: specific question]
4. Fill User Scenarios & Testing section
   → If no clear user flow: ERROR "Cannot determine user scenarios"
5. Generate Functional Requirements
   → Each requirement must be testable
   → Mark ambiguous requirements
6. Identify Key Entities (if data involved)
7. Run Review Checklist
   → If any [NEEDS CLARIFICATION]: WARN "Spec has uncertainties"
   → If implementation details found: ERROR "Remove tech details"
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY, including which Eve SDE datasets/manifest versions they rely on
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers
- 📦 Document assumptions about data freshness, access roles, checksum/manifest requirements, and compliance
- 🎨 Reference the filament UI experience (Background Web canvas, card gradients, sidebar layout) in terms of user expectations, not CSS specifics

### Section Requirements
- **Mandatory sections**: Must be completed for every feature
- **Optional sections**: Include only when relevant to the feature
- When a section doesn't apply, remove it entirely (don't leave as "N/A")

### For AI Generation
When creating this spec from a user prompt:
1. **Mark all ambiguities**: Use [NEEDS CLARIFICATION: specific question] for any assumption you'd need to make
2. **Don't guess**: If the prompt doesn't specify something (e.g., "login system" without auth method), mark it
3. **Think like a tester**: Every vague requirement should fail the "testable and unambiguous" checklist item
4. **Common underspecified areas**:
   - User types and permissions
   - Data retention/deletion policies  
   - Eve SDE archive version or update cadence
   - Checksums/manifest verification expectations
   - Postgres reporting requirements or downstream exports
   - Accessibility expectations for filament UI interactions and Background Web behavior (e.g., reduced motion)
   - Performance targets and scale
   - Error handling behaviors (e.g., SDE download failures, manifest mismatches)
   - Integration requirements
   - Security/compliance needs

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Fleet logisticians need to load the latest CCP SDE snapshot so they can explore blueprint and type information inside the Eve Data Browser without hand-maintaining YAML extracts.

### Acceptance Scenarios
1. **Given** the team has a fresh CCP SDE ZIP URL, **When** they trigger an ingestion run, **Then** the system records the source manifest (version + SHA-256), stores parsed type and blueprint data, and confirms success in the activity log.
2. **Given** a previously ingested SDE version exists, **When** the same archive is ingested again, **Then** the system detects the unchanged checksum, skips redundant database updates, and reports that no rotation was required.
3. **Given** a logistics analyst opens the Eve Data Browser UI, **When** they filter by ship category or enter a search term, **Then** the React interface displays matching SDE records with manifest metadata badges.
4. **Given** the ingestion worker cannot find a required SDE asset or detects a checksum mismatch, **When** the run executes, **Then** it aborts safely, preserves the prior manifest, and surfaces a clear failure status for operators.
5. **Given** the CCP static data page layout changes and assets are not discovered, **When** the watcher runs, **Then** it logs a warning, attempts configured fallback mirrors, and pauses ingestion until an operator supplies a valid archive.
6. **Given** a reviewer opens the Ships browser and selects a hull, **When** the detail view loads, **Then** a 3D model with faction lighting renders alongside multi-pane cards for characteristics, slots, lore, and stats sourced from the Ship Card contract.
7. **Given** a reviewer opens the Blueprints browser and selects a blueprint, **When** the detail view loads, **Then** the screen mirrors the EVE industry window with BOM grid, process visualization, outcome panel, and a market-style chart whose hover interactions highlight the relevant series using dummy data.
8. **Given** live market data is enabled, **When** the system fetches snapshots from Adam4EVE, **Then** the market chart updates to the latest 7/30 day ranges while respecting provider rate limits and retaining prior data.

### Edge Cases
- CCP static data page layout changes or required files are unavailable ⇒ ingestion must surface a warning, fall back to configured mirror/manual override, and block the run until an operator supplies a valid archive.
- Manifest checksum mismatch between download and stored expectations ⇒ run aborts, prior manifest remains active, and error details are logged.

## Requirements *(mandatory)*

### Functional Requirements
- **FR-001**: System MUST allow maintainers to initiate Eve SDE ingestion runs using official CCP download locations.
- **FR-002**: System MUST capture manifest metadata (version label, download timestamp, SHA-256) for each ingestion attempt.
- **FR-003**: System MUST persist parsed SDE ship and blueprint entities into the authoritative Postgres datastore so the browser can query them.
- **FR-004**: System MUST expose ingestion status and manifest metadata to the data browser API consumers.
- **FR-005**: System MUST provide a containerized runtime where ingestion, API, and frontend services share access to the `data/sde/` artifacts.
- **FR-006**: System MUST ensure re-ingesting an identical archive is idempotent and does not duplicate data or manifests.
- **FR-007**: System MUST flag and halt ingestion when required files or checksum validations fail, leaving prior manifest data intact.
- **FR-008**: System MUST allow frontend users to see that SDE-backed datasets reflect the latest manifest version and ingestion timestamp.
- **FR-009**: System MUST provide a React-based filament UI that supports search, filtering, and manifest badge display for ship and blueprint records.
- **FR-010**: Ship detail views MUST render a faction-themed 3D model with multi-pane information cards covering bonuses, slots, lore, and core stats.
- **FR-011**: Blueprint detail views MUST mimic the in-game industry/market UI with Bill of Materials grid, process visualization, and interactive price/volume charts (initially using dummy data).
- **FR-012**: Market data management MUST ingest provider snapshots (Adam4EVE initial), honour rate limits, store incremental updates, and expose `/market/{type_id}` for UI consumption.

### Key Entities *(include if feature involves data)*
- **SDE Manifest**: Label combining version string, checksum, source URL, ingestion timestamp, and status; drives manifest rotation decisions.
- **SDE Ship Record**: Metadata drawn from `invTypes` + attributes: type identifier, name, group/category references, race/faction, slot counts, attributes.
- **SDE Blueprint Record**: Manufacturing/reaction blueprint definition, including product identifiers, activities, materials, and times.
- **Filament UI View**: React component library that surfaces searchable tables, manifest badges, and reduced-motion controls backed by ship and blueprint datasets.
- **Preset Reference**: Derived tables mapping ships/blueprints to faction/race/group/category for theming and filters.
- **Blueprint Invention Record**: Separate store for invention data (datacores, base chance, decryptor metadata) linked via `blueprint_type_id`.
- **3D Asset Descriptor**: Metadata bundle mapping ships to glTF models, faction lighting presets, and fallback thumbnails.
- **Blueprint Analytics Model**: View model aggregating materials/products with dummy market trend series for chart rendering.

## Data Scope & Usage
- **Core ship facts** come from `types.yaml` (type ID, group/category, race/faction, base price, hull stats) enriched with `typeDogma.yaml` + `dogmaAttributes.yaml` so the UI can surface slot counts, CPU, powergrid, align time, and similar metrics without hard-coding attribute IDs.
- **Blueprint activities** are sourced from `blueprints.yaml`, including manufacturing and invention branches (materials, skills, production times, success probabilities) so the Blueprint card can mirror in-game behaviour.
- **Material composition** is lifted from `typeMaterials.yaml` to power bill of materials summaries and to pre-compute derived ship presets.
- **Lookup metadata** (`groups.yaml`, `categories.yaml`, `marketGroups.yaml`, `races.yaml`, `factions.yaml`) is retained to support localized labels and theming, while only the English strings are exposed in Phase-1 UI.
- **Oversized cartography files** (`mapMoons.yaml`, `mapPlanets.yaml`, `mapAsteroidBelts.yaml`) are explicitly skipped during this feature to keep ingestion runs under workstation memory limits; future phases can layer them in with separate tasks.
- **Market fixtures** continue to rely on Adam4EVE snapshots (`docs/data/market.md`) for live ranges, but the SDE's static `marketGroups.yaml` is used to align type IDs with The Forge market cards until live ingestion is toggled on.

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous  
- [x] Success criteria are measurable (include manifest/version references when relevant)
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified (including SDE cadence, checksums, accessibility expectations)

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [ ] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed

---
