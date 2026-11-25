# Water Management

This document describes the implemented water-management workflow in Agro Core.
It covers irrigation sectors, soil-moisture monitoring, irrigation scheduling and
execution, water usage, water sources, hydraulic infrastructure, water quality,
water balances, maintenance, and sensor verification.

The module records and compares operational information. It does not calculate an
agronomic prescription, open valves automatically, or replace technical review.

## Requirements coverage

| ID | Requirement | Status | Current implementation | Remaining gap |
| --- | --- | --- | --- | --- |
| WM-01 | Define irrigation areas with their crop block, area, irrigation system, water source, reference flow, measurement unit, measurement depth, and optional sensor. | Implemented | Irrigation sectors are persisted and displayed with block, area, system, source, flow, moisture unit, depth, sensor, and technical configuration. | Richer hydraulic topology and map layers are still pending. |
| WM-02 | Record soil-moisture measurements with date, value, unit, depth, instrument, rainfall, drainage, and notes. | Implemented | Manual measurements are stored per sector and retain the sector unit and depth. Sensor readings can also be associated with a sector. | Reliable production telemetry and broader data-quality workflows remain pending. |
| WM-03 | Configure technically justified moisture thresholds and reading freshness. | Implemented | Each sector supports lower and upper limits, maximum reading age, technical basis, versioning, and revision history. | Threshold recommendations and farm/variety-specific agronomic profiles are not automated. |
| WM-04 | Schedule irrigation for a sector with a date, time, planned duration, planned volume, responsible person, justification, and instructions. | Implemented for one-time and recurring plans | Managers can create one-time plans or daily/weekly recurring rules, preview upcoming occurrences, generate idempotent plans/tasks, edit future rules, pause, resume, and cancel them. | Approval workflow, calendar integration, and schedule optimization remain pending. |
| WM-05 | Record actual irrigation and water consumption. | Implemented | Execution records capture actual start/end, interruptions, effective duration, volume measured by meter or estimated from flow, notes, and variance reasons. Reports compare planned and actual volume by sector and block, separate measured and estimated consumption, and relate it to rainfall, balance requirements, deficits, and soil-moisture readings. | Automated meter reconciliation and weather-service integration remain pending. |
| WM-06 | Detect moisture and irrigation exceptions that need review. | Implemented for operational alerts | The UI flags below-range, above-range, stale, or missing moisture readings, overdue plans, plan deviations, and blocked maintenance. | Alert-to-irrigation automation, escalation, and external notification delivery remain pending. |
| WM-07 | Manage water sources, quality, and hydraulic assets. | Implemented for records and edits | Sources support type, capacity, coordinates, notes, active status, and versioned edits. Quality records support pH, conductivity, salinity, suspended solids, laboratory reference, notes, and versioned edits. Assets support pumps, valves, pipes, filters, meters, drains, canals, reservoirs, status, block/source links, coordinates, and versioned edits. | Permits and a complete map of hydraulic connections remain pending. |
| WM-08 | Track water balance, maintenance, and sensor calibration. | Implemented for records and edits | Balances store rainfall, ET0, crop coefficient, root depth, available water, required/applied volume, deficit, and versioned edits. Maintenance stores sector or asset, activity, date, status, pressure, flow, notes, completion date, and versioned edits. Sensor checks store calibration status, reference/observed values, technician, notes, and versioned edits. | Automated balance calculations, maintenance task integration, and calibration-driven data suppression remain pending. |

## Operational workflow

1. **Configure a sector.** A manager associates a sector with a block and records
   its irrigation system, water source, area, measurement unit, measurement depth,
   and optional sensor.
2. **Set technical limits.** The responsible technical user records the lower and
   upper moisture limits, the maximum age of a valid reading, and the technical
   basis. Limits are versioned when changed.
3. **Measure conditions.** A user records a manual reading with its instrument,
   rainfall, drainage, and notes, or the sector receives a compatible sensor reading.
4. **Review conditions.** The module classifies the latest reading as below range,
   in range, above range, stale, or without data when the required information is
   available. It does not infer an agronomic recommendation from that classification.
5. **Schedule irrigation.** A manager creates a one-time plan with the target
   sector, planned date/time, duration, volume, assignee, technical justification,
   and execution instructions, or creates a recurring rule with a daily/weekly
   interval and start/end dates.
6. **Generate repeated work.** Active recurring rules materialize each occurrence
   as a normal irrigation plan and farm task. The schedule/date uniqueness key and
   the daily generator prevent duplicate plans or tasks. The background job runs
   daily (default cron: 00:15 in the API server's time zone) and fills the next 30
   days; managers can also preview or generate occurrences and pause, resume, edit,
   or cancel future generation. Set `AGRO_IRRIGATION_RECURRING_CRON` through the
   Spring property `agro.irrigation.recurring.cron` to change the job schedule.
7. **Generate and execute the task.** The plan can generate one farm task. The
   assigned worker or an authorized manager records execution using a meter or a
   flow estimate. Overlapping executions for the same sector are rejected.
8. **Verify and preserve history.** Actual volume and duration accumulate against
   the plan. Exceeding the planned amount requires a reason, and the execution is
   linked to an `IRRIGATION_EVENT` with optional photo evidence.
9. **Correct operational records.** Authorized managers can edit water sources,
   quality analyses, hydraulic assets, balances, maintenance, and sensor checks.
   Updates are farm-scoped and use optimistic version checks to reject stale edits.
10. **Analyze usage.** The Reports screen filters water usage by date range and
    sector/block, presents planned versus applied volume and measured versus
    estimated origin, compares rainfall and balance deficits, and exports the
    visible sector report as CSV.

## Water-management records

### Soil moisture

The supported units are volumetric percentage (`VWC_PERCENT`), gravimetric
percentage (`GRAV_PERCENT`), and kilopascals (`KPA`). Units and measurement depths
must match the sector configuration. Percentage values are constrained to 0–100;
the module does not treat the three units as interchangeable.

Reading freshness is evaluated per sector using its configured maximum age. A stale
or missing reading produces an operational warning rather than an automatic watering
decision. Rainfall and drainage are retained as context for later technical review.

### Irrigation execution and usage

Meter-based execution stores the meter unit and starting/ending readings. Flow-based
execution stores the flow in cubic metres per hour and derives volume from effective
duration. Effective duration subtracts recorded interruptions. Multiple partial
executions can be recorded against a plan while the plan tracks cumulative actual
volume and duration.

The module requires a variance reason when cumulative actual volume or duration
exceeds the planned values. It rejects future timestamps, invalid meter sequences,
non-positive effective duration, and overlapping executions for a sector.

### Water sources and infrastructure

Water sources can be wells, reservoirs, canals, rivers, rainwater, or another source.
Hydraulic assets can be pumps, valves, pipes, filters, meters, drains, canals,
reservoirs, or other assets. Sources and assets may include coordinates and notes;
assets can be associated with a block and a water source.

Water-quality records are linked to a source and may include laboratory references.
The database validates pH from 0 to 14 and prevents negative analytical values.

### Balances, maintenance, and calibration

Water balances are recorded by sector and date. The record can include rainfall,
reference evapotranspiration, crop coefficient, root depth, available water,
required volume, applied volume, and deficit. A sector may have only one balance for
each date.

Maintenance can target either a sector or a hydraulic asset, but not both. Supported
activities include filter washing, pump and valve checks, leak repair, meter
calibration, drain cleaning, and other maintenance. Sensor checks retain the sensor,
sector, date, calibration status, reference value, observed value, technician, and
notes.

## User interface

The **Riego** screen is organized into four tabs:

- **Mediciones:** sector configuration, moisture history, and operational alerts.
- **Programación:** one-time and recurring schedules, task/occurrence generation,
  upcoming-occurrence preview, pause/resume/edit/cancel controls, and preserved
  sector context.
- **Ejecuciones:** actual duration, volume origin, interruptions, variance, and
  attached evidence; executions can be exported to CSV.
- **Administración de agua:** sources, quality, hydraulic infrastructure, balances,
  maintenance, and sensor calibration checks.

The **Reportes** screen also includes a water-use report with period and sector/block
filters, KPI cards, a sector comparison table, and CSV export. It reads the same
farm-scoped irrigation records as the Riego screen and labels demo values as fictitious.

The demo mode uses local browser storage and clearly labels its initial data as
fictitious. Real mode reads and writes through the server API.

## API

The irrigation controller is rooted at `/api/v1/irrigation`.

| Operation | Endpoint |
| --- | --- |
| List irrigation data | `GET /api/v1/irrigation?farmId={farmId}` |
| Create sector | `POST /api/v1/irrigation/sectors` |
| Update sector thresholds | `POST /api/v1/irrigation/sectors/{id}/thresholds` |
| Record moisture measurement | `POST /api/v1/irrigation/measurements` |
| Create irrigation plan | `POST /api/v1/irrigation/plans` |
| Generate task | `POST /api/v1/irrigation/plans/{id}/task` |
| Cancel plan | `POST /api/v1/irrigation/plans/{id}/cancel` |
| Record execution | `POST /api/v1/irrigation/plans/{id}/executions` |
| Create recurring schedule | `POST /api/v1/irrigation/recurring-schedules` |
| Update recurring schedule | `PATCH /api/v1/irrigation/recurring-schedules/{id}` |
| Generate upcoming recurring plans/tasks | `POST /api/v1/irrigation/recurring-schedules/{id}/generate` |
| Pause recurring schedule | `POST /api/v1/irrigation/recurring-schedules/{id}/pause` |
| Resume recurring schedule | `POST /api/v1/irrigation/recurring-schedules/{id}/resume` |
| Cancel recurring schedule | `POST /api/v1/irrigation/recurring-schedules/{id}/cancel` |
| Preview recurring schedule | `GET /api/v1/irrigation/recurring-schedules/{id}/preview` |
| Read recurring schedule history | `GET /api/v1/irrigation/recurring-schedules/{id}/history` |
| Create water source | `POST /api/v1/irrigation/water-sources` |
| Update water source | `PATCH /api/v1/irrigation/water-sources/{id}` |
| Record water quality | `POST /api/v1/irrigation/water-sources/{id}/quality` |
| Update water quality | `PATCH /api/v1/irrigation/water-quality/{id}` |
| Create hydraulic asset | `POST /api/v1/irrigation/infrastructure` |
| Update hydraulic asset | `PATCH /api/v1/irrigation/infrastructure/{id}` |
| Record water balance | `POST /api/v1/irrigation/water-balances` |
| Update water balance | `PATCH /api/v1/irrigation/water-balances/{id}` |
| Record maintenance | `POST /api/v1/irrigation/maintenance` |
| Update maintenance | `PATCH /api/v1/irrigation/maintenance/{id}` |
| Record sensor check | `POST /api/v1/irrigation/sensor-checks` |
| Update sensor check | `PATCH /api/v1/irrigation/sensor-checks/{id}` |

The analytics controller is rooted at `/api/v1/analytics`.

| Operation | Endpoint |
| --- | --- |
| Water-use report | `GET /api/v1/analytics/water-usage?farmId={farmId}&from={yyyy-mm-dd}&until={yyyy-mm-dd}` |

Farm membership and manager permissions are enforced by the backend. Sensor device
registration and raw telemetry ingestion are provided by the sensor endpoints and
are consumed by irrigation sectors when associated.

## Persistence and implementation evidence

- `src/main/java/com/yourco/agro/irrigation/IrrigationController.java`
- `src/main/java/com/yourco/agro/irrigation/IrrigationService.java`
- `src/main/java/com/yourco/agro/irrigation/IrrigationDtos.java`
- `src/main/resources/db/migration/V11__irrigation_workflow.sql`
- `src/main/resources/db/migration/V13__irrigation_water_and_maintenance.sql`
- `src/main/resources/db/migration/V23__irrigation_management_updates.sql`
- `src/main/resources/db/migration/V17__irrigation_recurring_schedules.sql`
- `src/main/java/com/yourco/agro/irrigation/IrrigationRecurrenceJob.java`
- `src/main/java/com/yourco/agro/analytics/AnalyticsController.java`
- `src/main/java/com/yourco/agro/analytics/AnalyticsService.java`
- `frontend/src/pages/Irrigation.tsx`
- `frontend/src/pages/Operations.tsx`
- `frontend/src/lib/analytics.ts`
- `frontend/tests/irrigation.spec.ts`

## Remaining gaps

- Full approval, calendar, escalation, and notification workflows.
- Automated meter/telemetry reconciliation and weather-service integration.
- Complete hydraulic map showing sources, pipes, valves, drains, and relationships.
- Permission policies for water-source, infrastructure, and technical-threshold administration.
- Offline capture and synchronization for field operations.

## Verification

The focused backend tests are:

```text
./gradlew test --tests com.yourco.agro.IrrigationApiTest
./gradlew test --tests com.yourco.agro.IrrigationPostgresTest
```

The frontend irrigation workflow can be verified from `frontend` with:

```text
npm run build
npm run test:e2e -- tests/irrigation.spec.ts -g "water management records"
npm run test:e2e -- tests/irrigation.spec.ts -g "recurring irrigation schedules"
npm run test:e2e -- tests/irrigation.spec.ts -g "water usage report"
```
