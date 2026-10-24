# Crop Management Requirements Audit

This document is the current implementation audit for crop management. It maps the requested capabilities to repository evidence, identifies the implementation status, and records the remaining gap for each requirement.

**Audit scope:** crop master data, varieties, planting cycles, regional calendars, agronomist access, nutrient management, water management, disease and pest management, and production records.

## Status legend

- **Implemented** — the capability is represented in the application and has an API, persistence, UI, or automated test where applicable.
- **Partial** — the core data or workflow exists, but an important workflow, rule engine, integration, or user experience is incomplete.
- **Planned** — the capability is identified but is not yet implemented as a usable end-to-end workflow.

## Summary

| Capability | Status | Main gap |
| --- | --- | --- |
| Crop database and varieties | Implemented | Add richer agronomic reference data and complete catalog lifecycle management. |
| Crop lifecycle and planting cycles | Implemented | Add more automated stage transitions and production-cycle reconciliation. |
| Regional planting calendars | Implemented | Add reusable regional templates, weather-aware recommendations, and calendar-driven task generation. |
| Agronomist permissions | Partial | Add fine-grained permissions and delegated/time-bound access; role assignment remains an administrator function. |
| Nutrient management | Partial | Add automatic deficiency diagnosis, fertilizer/product standards, and complete recurring plan workflows. |
| Water management | Partial | Complete recurring irrigation planning and connect measurements to reliable sensor/meter data. |
| Disease and pest management | Partial | Add controlled pest/disease catalogs, preventive rules, intervention thresholds, and approved treatment plans. |
| Production records | Partial | Add production planning, forecast-versus-actual reconciliation, and complete harvest/lot traceability. |

## Detailed requirements matrix

### Crop database and planting

| ID | Requirement | Status | Implemented evidence | Gap |
| --- | --- | --- | --- | --- |
| CM-01 | Store farm-scoped crop master records with a code, name, and active state. | Implemented | `V14__crop_variety_catalog.sql`, `CropCatalogController`, and `CropCatalogService`. | No shared/global agronomic catalog or richer crop attributes such as botanical classification, maturity, or default production parameters. |
| CM-02 | Store crop varieties and associate each variety with its parent crop. | Implemented | `V14__crop_variety_catalog.sql` and crop catalog API/UI. | Variety lifecycle editing/archiving and agronomic attributes such as seed source, maturity range, resistance, and supplier are limited. |
| CM-03 | Associate blocks, planting cycles, and material lots with the crop/variety catalog. | Implemented | Crop and variety identifiers are wired into planting, block, and material-lot workflows. | Legacy text compatibility remains; a future migration can make catalog references mandatory for all historical records. |
| CM-04 | Record planting cycle data including crop, variety, block, planting date, expected harvest date, area, and growth stage. | Implemented | `PlantingDtos`, `PlantingController`, planting-cycle persistence, and the planting UI. The cycle detail now exposes site assessment, material acceptance, planting plan, execution, establishment checks, and stage history controls. | Growth-stage progression is primarily user-driven; automatic stage changes, replant links, and actual-versus-expected lifecycle reconciliation are not complete. |
| CM-05 | Maintain regional planting calendars with annual planting windows, optional variety rules, perennial support, and preparation lead time. | Implemented | `V15__agronomist_role_and_planting_calendars.sql`, `PlantingCalendarController`, `PlantingCalendarService`, and Settings calendar UI. | No reusable regional template hierarchy, weather/forecast integration, or automatic preparation and replanting task generation. |
| CM-06 | Give agronomists access to agronomic configuration and approval workflows without granting team administration. | Partial | `AGRONOMIST` role, `FarmAccess.requireAgronomic`, module-level access checks, and role-aware Settings UI. | Permissions are role-wide rather than capability-based; assignment is still administrator-controlled, and there is no delegation, expiry, or per-region/per-module permission policy. |

### Nutrient management

| ID | Requirement | Status | Implemented evidence | Gap |
| --- | --- | --- | --- | --- |
| CM-07 | Record soil nutrient levels and related soil-analysis values for a location or block. | Implemented | Fertilization soil-analysis endpoints and persistence store pH and nutrient fields such as N, P, and K. | Add broader nutrient and physical-soil coverage, laboratory import, sampling protocols, and stronger location/season traceability. |
| CM-08 | Identify nutrient deficiencies from soil results and crop context. | Partial | A provisional banana/plantain soil profile classifies compatible results as low, adequate, high, or unknown and explains the matched range; every result remains pending technical review. | Farm/variety-specific profiles, method-aware validation, persisted agronomist confirmation, confidence scoring, and any recommendation engine remain incomplete. |
| CM-09 | Record fertilizer applications with product, quantity, unit, date, location, and notes. | Implemented | Fertilization application DTOs, controller/service workflows, validation, and totals/reporting. | No authoritative fertilizer-product catalog, standardized dose/unit conversions, inventory linkage, or full compliance/withdrawal tracking. |
| CM-10 | Create, approve, execute, and monitor fertilizer plans, including recurring applications. | Partial | Fertilization plan/application workflows and approval-related endpoints exist. | Recurrence, complete plan-to-deficiency linkage, product/dose standards, and automated scheduled task generation remain incomplete. |

### Water management

| ID | Requirement | Status | Implemented evidence | Gap |
| --- | --- | --- | --- | --- |
| CM-11 | Define irrigation schedules or plans for crop areas and record execution. | Partial | Irrigation plan, task, execution, sector, threshold, and maintenance workflows exist in `IrrigationController` and irrigation migrations. | Recurrence, approval, calendar integration, and schedule optimization are not complete end to end. |
| CM-12 | Record irrigation water usage and support water-source and balance tracking. | Implemented | Water sources, quality, execution records, balances, and infrastructure are persisted and exposed through irrigation APIs. | Meter/telemetry integration, automated reconciliation, and stronger water-use analytics are still needed. |
| CM-13 | Record soil moisture measurements and use thresholds to guide irrigation decisions. | Partial | Manual moisture measurements, thresholds, sensor checks, and related irrigation data are supported. | No complete sensor ingestion/current-state model, calibration/data-quality workflow, or reliable alert-to-irrigation automation. |

### Disease and pest management

| ID | Requirement | Status | Implemented evidence | Gap |
| --- | --- | --- | --- | --- |
| CM-14 | Log pest and disease occurrences with location, severity, affected plants, observations, and follow-up status. | Implemented | Crop monitoring records and phytosanitary inspections support structured observations, severity, affected counts, follow-ups, review, and cancellation. | Controlled pest/disease taxonomy, richer occurrence editing, and consistent cross-module identifiers are still needed. |
| CM-15 | Maintain preventive measures and apply them to relevant crops, regions, or risk conditions. | Partial | Preventive measure templates can be created per farm, assigned to blocks, marked in progress or completed with optimistic versioning, and documented with evidence references. | Add crop/variety and regional applicability, risk triggers, recurring schedules, automatic assignments, and richer completion media. |
| CM-16 | Record disease/pest treatments and evidence, including approval and outcome monitoring. | Partial | Treatment records, evidence/media, inspection review, and follow-up workflows are implemented. | Add approved treatment plans, product/dose/safety catalog data, intervention thresholds, efficacy outcomes, and re-entry/withdrawal controls. |

### Production records

| ID | Requirement | Status | Implemented evidence | Gap |
| --- | --- | --- | --- | --- |
| CM-17 | Capture production area and support yield estimation by crop, variety, block, and cycle. | Partial | Block area, planting-cycle data, and analytics expose harvested quantities and estimated-yield values. | Add an explicit yield-estimation workflow with assumptions, stage-based estimates, confidence, and forecast history. |
| CM-18 | Record harvest events with quantity, unit, date, location, and quality information. | Implemented | Harvest events and structured quantity/quality data are supported through event and analytics workflows. | Add complete harvest-lot traceability, grading standards, storage/dispatch linkage, and correction/audit workflows. |
| CM-19 | Compare estimated production with actual harvest and produce production reports. | Planned | Basic harvest and analytics data exists, but there is no complete forecast-versus-actual production workflow. | Add period/cycle reporting, variance calculations, quality and loss reasons, and exportable production summaries. |

### Cross-cutting crop-management controls

| ID | Requirement | Status | Implemented evidence | Gap |
| --- | --- | --- | --- | --- |
| CM-20 | Link agronomic records to farms, blocks, crop cycles, users, and supporting media for traceability. | Partial | Farm access isolation, block/cycle references, event records, inspection evidence, and media APIs are present. | Add a unified audit timeline, immutable change history, and consistent traceability across every agronomic record type. |
| CM-21 | Generate actionable tasks from agronomic plans and monitor completion. | Partial | Approved planting plans can generate field tasks from the cycle detail; task workflows also exist for selected fertilization, irrigation, and inspection operations. | Automatic generation from calendars, recurrence, dependencies, escalation, and complete cross-module coverage remain incomplete. |
| CM-22 | Provide alerts and notifications for deficiencies, irrigation needs, pests, diseases, overdue work, and calendar windows. | Planned | The underlying records and thresholds exist in several modules. | Add notification rules, channels, user preferences, acknowledgement, escalation, and delivery history. |
| CM-23 | Support offline/mobile capture and synchronization for field operations. | Planned | The web application supports online field data entry. | Add offline storage, queued writes, conflict resolution, synchronization status, and attachment retry handling. |

## Priority gaps

1. Add controlled agronomic catalogs for crops, varieties, fertilizer products, pests, diseases, treatments, and preventive measures.
2. Complete deficiency diagnosis and intervention-threshold rules so recorded observations produce actionable recommendations.
3. Finish recurring plan execution and automatic task generation for planting calendars, fertilization, and irrigation.
4. Introduce fine-grained agronomist permissions and a unified audit trail across agronomic records.
5. Add forecast-versus-actual production reporting, harvest-lot traceability, notifications, and offline field synchronization.

## Related documentation

- `README.md` — product requirements, role matrix, API inventory, and roadmap.
- `docs/fertilization.md` — current fertilization workflow details.
- `docs/water-management.md` — current irrigation and water-management workflow details.
- `docs/guias-agronomicas-aplicadas.md` — agronomic guidance and operational context.
