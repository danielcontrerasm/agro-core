# Crop Management Requirements Audit

Last reviewed: **2026-11-21**.

This document audits **crop management only**: crop master data, varieties,
planting cycles, lote evaluation, planting material, planting plans, field
execution, establishment, phenology, regional calendars, and agronomist access.

Nutrient, water, pest/disease, and production management are separate modules and
are intentionally excluded from this audit.

## Overall coverage

**Estimated functional coverage: approximately 80%.** The end-to-end crop
workflow is usable. The remaining work is concentrated in automation, richer
catalog data, fine-grained permissions, and unified auditability. This is a
product-completeness estimate, not an automated test-coverage percentage.

## Status legend

- **Implemented** — usable end-to-end functionality exists in the API, persistence,
  UI, and/or workflow where applicable.
- **In progress** — the core capability exists, but important behavior or controls
  remain incomplete.
- **Missing** — there is no usable end-to-end implementation yet.
- **Planned** — missing work identified for a future delivery.

## Summary

| Capability | Status | Current coverage | Remaining gap |
| --- | --- | --- | --- |
| Crop master catalog | Implemented | Farm-scoped crop records, codes, names, active state, and catalog UI. | Richer agronomic reference attributes and complete lifecycle editing/archive. |
| Crop varieties | In progress | Varieties are associated with parent crops and selectable in planting workflows. | Seed/source, maturity, resistance, supplier data, and full lifecycle management. |
| Planting cycles | In progress | Cycles store block/row, crop/variety, planting window, expected harvest, current stage, and stage history. Planned area and density belong to associated planting plans; actual area and plant counts belong to execution records. | Cycle-level area reconciliation, automatic stage transitions, replant links, and planned-versus-actual lifecycle reconciliation. |
| Site/lote evaluation | Implemented | Assessment creation, review, approval, and rejection are available in the cycle workflow. | More rule-based risk validation and richer assessment history. |
| Planting material | Implemented | Material lots can be registered and accepted or rejected before planting. | Complete lot-document lifecycle and stronger catalog validation. |
| Planting plan and execution | Implemented | Area, density, responsible person, approval, task creation, and execution are available. | Calendar- and stage-driven scheduling and broader task automation. |
| Establishment and phenology | In progress | Checks record inspected, surviving, dead, and replaced plant counts; dated stage observations and history are available. | Structured resowing follow-up, automatic replacement work, stage progression, alerts, and stronger cycle reconciliation. |
| Regional calendars | In progress | Annual/perennial rules, suggestions, preparation lead time, and cycle-window validation exist. | Reusable templates, weather context, and automatic work generation. |
| Agronomist access | In progress | AGRONOMIST role, agronomic access checks, configuration access, and approvals exist. | Capability-based, delegated, time-bound, regional, or module-specific permissions. |
| Crop scheduling automation | Missing | Approved planting plans can create tasks manually. | Automatic preparation, planting, replanting, and stage-driven task generation. |
| Crop audit trail | Missing | Farm, block, cycle, user, approval, and media references exist. | Unified immutable history of crop record changes and decisions. |

## Detailed requirements matrix

| ID | Requirement | Status | Implemented evidence | Gap or next work |
| --- | --- | --- | --- | --- |
| CM-01 | Store farm-scoped crop master records with code, name, and active state. | Implemented | `V14__crop_variety_catalog.sql`, `CropCatalogController`, `CropCatalogService`, and catalog UI. | Add richer agronomic attributes and shared reference-data support. |
| CM-02 | Store varieties and associate each variety with its parent crop. | In progress | Crop/variety persistence and API/UI association exist. | Add maturity, resistance, source, supplier, edit, archive, and approval lifecycle. |
| CM-03 | Associate blocks, planting cycles, and material lots with crop and variety records. | Implemented | Catalog identifiers are wired into block, cycle, and material-lot workflows. | Gradually make catalog references mandatory for legacy-compatible records. |
| CM-04 | Record a crop cycle by block with crop, variety, dates, area, expected harvest, and growth stage. | In progress | `PlantingDtos`, `PlantingController`, cycle persistence, and the Planting page provide the core flow. The cycle stores planting dates, expected harvest, current stage, and stage history; planned area/density are held by planting plans, and actual area/plant counts by execution records. | Add a cycle-level view and reconciliation of planned versus actual area and dates, automatic stage changes, and replant links. |
| CM-05 | Evaluate a lot/site before planting, including risks and technical approval. | Implemented | Site-assessment creation, review, approval, and rejection are available from cycle details. | Add rule-based risk validation and more complete assessment history. |
| CM-06 | Register planting-material lots and accept or reject them before use. | Implemented | Material-lot creation and decision endpoints are available in the planting workflow. | Complete document/certificate lifecycle and stronger lot-to-cycle traceability. |
| CM-07 | Create, approve, and execute a planting plan with area, density, responsible person, and target window. | Implemented | Planting-plan persistence, approval/cancellation, task creation, execution records, and UI controls exist. | Add reusable plan templates and automatic scheduling from calendar rules. |
| CM-08 | Record establishment checks, survival, mortality, replacement, and resowing follow-up. | In progress | Establishment-check endpoint and cycle follow-up UI store inspected, surviving, dead, and replaced plant counts with dated notes. | Add structured resowing follow-up, automatic replacement work generation, count reconciliation, and cycle-level alerts. |
| CM-09 | Record dated phenological stage observations for each cycle. | Implemented | Stage endpoint, stage history, and Planting page controls are available. | Add automatic progression rules and stage-based task triggers. |
| CM-10 | Maintain regional annual and perennial planting calendars by region, crop, and optional variety. | In progress | `V15__agronomist_role_and_planting_calendars.sql`, calendar API, suggestions, and Settings UI exist. | Add reusable regional templates, weather-aware recommendations, and automatic preparation/replanting tasks. |
| CM-11 | Give agronomists agronomic configuration and approval access without team administration. | In progress | `AGRONOMIST` role, `FarmAccess.requireAgronomic`, module checks, and role-aware Settings UI exist. | Add capability-level permissions, delegation, expiry, and region/module scope. |
| CM-12 | Generate crop-management tasks automatically from calendars, stages, approved plans, and resowing needs. | Missing | A manager can manually generate one task from an approved planting plan; repeating the request returns the plan's existing task. No calendar-, stage-, or resowing-triggered scheduler exists. | Build automatic, idempotent, dependency-aware generation with overdue/escalation handling. |
| CM-13 | Maintain a unified audit history for crop records, approvals, and workflow decisions. | Missing | Individual records retain farm/block/cycle/user references and media links. | Add immutable change history and a cycle-level audit timeline. |

## Implemented user-facing workflow

The Planting page currently supports:

1. Create and view a crop cycle.
2. Evaluate and approve/reject the site or lot.
3. Register and accept/reject planting material.
4. Create and approve the planting plan.
5. Generate work and record field execution.
6. Record establishment and replacement follow-up.
7. Update and review phenological stages.

Crop and variety catalogs and regional calendars are managed from the Settings
area. The main crop-management API groups are `/api/v1/catalog/crops`,
`/api/v1/planting`, and `/api/v1/planting-calendars`.

## Complete endpoint inventory

The following table lists every endpoint owned by the crop catalog, planting, and
regional-calendar controllers. All routes require an authenticated session and
farm access; write routes also require CSRF protection.

### Crop catalog

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/catalog/crops?farmId={farmId}` | List the farm's crops and varieties. |
| POST | `/api/v1/catalog/crops` | Create a farm crop. |
| POST | `/api/v1/catalog/crops/{cropId}/varieties` | Create a variety under a crop. |

### Planting workflow

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/planting?farmId={farmId}` | List cycles and their planting workflow data for a farm. |
| POST | `/api/v1/planting/cycles` | Create a planting cycle. |
| POST | `/api/v1/planting/cycles/{id}/site-assessment` | Record a site/lote assessment. |
| POST | `/api/v1/planting/cycles/{id}/site-assessment/approve` | Approve a site assessment. |
| POST | `/api/v1/planting/cycles/{id}/site-assessment/reject` | Reject a site assessment. |
| POST | `/api/v1/planting/material-lots` | Register planting material. |
| POST | `/api/v1/planting/material-lots/{id}/decision` | Accept or reject planting material. |
| POST | `/api/v1/planting/plans` | Create a planting plan. |
| POST | `/api/v1/planting/plans/{id}/approve` | Approve a planting plan. |
| POST | `/api/v1/planting/plans/{id}/cancel` | Cancel a planting plan. |
| POST | `/api/v1/planting/plans/{id}/task` | Generate a field task from an approved plan. |
| POST | `/api/v1/planting/plans/{id}/executions` | Record field execution of a planting plan. |
| POST | `/api/v1/planting/cycles/{id}/establishment-checks` | Record establishment, survival, mortality, or replacement follow-up. |
| POST | `/api/v1/planting/cycles/{id}/stages` | Record a phenological stage observation. |

### Regional planting calendars

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/v1/planting-calendars?farmId={farmId}` | List calendar rules for a farm. |
| GET | `/api/v1/planting-calendars/suggestions?farmId={farmId}&cropId={cropId}[&varietyId={varietyId}&year={year}]` | Resolve applicable planting-window suggestions. |
| POST | `/api/v1/planting-calendars` | Create a calendar rule. |
| PUT | `/api/v1/planting-calendars/{id}` | Update a calendar rule. |
| DELETE | `/api/v1/planting-calendars/{id}` | Deactivate a calendar rule. |

The planting controller currently returns workflow data from the farm-level list
route. There are no separate GET-by-id, update, or delete routes yet for cycles,
material lots, planting plans, executions, establishment checks, or stage
observations. Crop and variety records also have create/list routes only; full
catalog lifecycle endpoints are part of the in-progress work.

## Planned next work

1. Complete crop and variety catalog lifecycle and agronomic reference attributes.
2. Automate stage transitions and calendar-driven preparation, planting, and resowing tasks.
3. Add delegated and time-bound agronomist permissions.
4. Add unified crop-cycle approvals, history, and change traceability.

## Related documentation

- `README.md` — current repository overview, local setup, feature coverage, and API areas.
- `docs/system-requirements.md` — cross-product functional and non-functional requirements.
- `docs/guias-agronomicas-aplicadas.md` — agronomic guidance and operational context.
