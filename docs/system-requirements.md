# Agro Core System Requirements

Last reviewed: **2026-11-21**.

This document tracks the cross-product functional and non-functional
requirements for the Agro Core API and AgroVision. It describes the current
behavior and gaps visible in the repository; a status of **Implemented** does
not certify production readiness, performance, accessibility, or agronomic
validity. Detailed module inventories are kept in the [crop-management audit](crop-management-requirements.md),
[fertilization guide](fertilization.md), and [water-management guide](water-management.md).

## Status definitions

| Status | Meaning |
| --- | --- |
| **Implemented** | The described capability exists in the current API and/or user workflow. Module documents identify any narrower limitations. |
| **Partial** | A useful part of the workflow exists, but one or more behaviors or controls in the requirement are missing. |
| **In progress** | Core workflow coverage exists and remaining development is listed with the requirement. |
| **Missing** | No usable implementation of the requirement exists. |
| **Planned** | Missing work has been identified for a future delivery; this is not a commitment or schedule. |
| **Proposed target** | A quality goal for discussion and measurement, not a current service guarantee. |

## Functional requirements

### Accounts and farm access

| ID | Requirement | Current state |
| --- | --- | --- |
| FR-01 | Register with a name, unique normalized email, and valid password. A new account must not inherit access to existing farms. | **Implemented.** Registration creates a user; farm membership is separate. |
| FR-02 | Sign in, read the current profile and farm memberships, and sign out. Reject invalid credentials and invalidate the session on logout. | **Implemented.** Uses an HTTP session and CSRF-protected writes. |
| FR-03 | Let an authenticated user create a farm and grant the creator administrator access to it. | **Implemented.** Farm and creator membership are created together. |
| FR-04 | Let a farm administrator add an existing user and assign or change that user's per-farm role. | **Implemented.** Roles are `ADMIN`, `SUPERVISOR`, `AGRONOMIST`, and `WORKER`; self-demotion is rejected. Membership removal is not available. |
| FR-05 | Restrict farm data and actions by membership and role. | **Partial.** Farm scoping is enforced across current domain APIs, but administrative permissions are not yet a complete, uniform policy across every module. See the module-specific permission gaps. |
| FR-06 | Support password recovery, email verification, and administrator removal of a farm membership. | **Planned.** None of these account-lifecycle flows is available. |

### Farm structure and agricultural history

| ID | Requirement | Current state |
| --- | --- | --- |
| FR-07 | Create, list, retrieve, and delete farms, fields, blocks, and rows with parent filters and farm authorization. | **Implemented.** Update operations are not exposed for these resources. |
| FR-08 | Store field/block polygons, row lines, and supplied measurements using longitude/latitude coordinates. | **Implemented.** Geometry uses SRID 4326; polygon input currently supports one outer ring. Area, length, spacing, and plant counts are supplied or estimated values, not survey-derived measurements. |
| FR-09 | Record agricultural events against a block and/or row with type, occurrence time, notes, optional GPS, and optional plant range. The authenticated user determines authorship. | **Implemented.** The seven event types are scouting, treatment, fertilizer, irrigation, handling, soil sample, and harvest. |
| FR-10 | Search and retrieve authorized events by farm, block, row, type, and time range; let authorized managers delete events. | **Implemented.** Some events tied to approved irrigation or fertilization workflows cannot be deleted independently because their history must remain linked. |
| FR-11 | Record and review pest/disease observations, affected plants/area, symptoms, severity, follow-up, and managed problem selection. | **Partial.** The dedicated inspection workflow supports catalog selection, review, follow-ups, treatments, and cancellation. Legacy event observations are not independently editable, and there is no laboratory confirmation or risk-triggered intervention workflow. |
| FR-12 | Provide an authorized GeoJSON disease-observation layer with row geometry, severity summary, count, and latest observation time. | **Implemented.** This summarizes recorded observations; it is not a diagnosis or prediction. |
| FR-13 | Upload, view, and download authorized JPEG/PNG photos for events and inspections/treatments, retaining legacy media references. | **Implemented for photos.** Photo bytes are stored in PostgreSQL. S3 uploads, presigned URLs, and other photo file types are not part of this workflow. |

### Daily work and crop operations

| ID | Requirement | Current state |
| --- | --- | --- |
| FR-14 | Let an authorized farm manager create and assign a dated task with activity, field/block, instructions, and priority. | **Partial.** Admins, supervisors, and agronomists can assign farm members and target a field or block. Row targeting, rescheduling, and task editing are not available. |
| FR-15 | Assign a task only to a member of the same farm and prevent cross-farm assignments. | **Implemented.** Assignment to crews is not available. |
| FR-16 | Let workers see their assigned work for a selected day and outstanding overdue tasks, with useful location filters. | **Partial.** The UI supports task lists, date selection, search, and location filtering. It uses the device calendar because farms have no configured time zone. |
| FR-17 | Let workers start work, record blockers, and submit execution details for review. | **Partial.** Status changes, blocker reasons, and notes are persisted. Actual quantities, execution time, and task evidence are not captured as structured task data. |
| FR-18 | Let an authorized manager approve or return submitted work and link approved execution to agricultural history without duplicate completion records. | **Partial.** Admins, supervisors, and agronomists can complete or return a task from review; there is no required return reason or link from task completion to an agricultural event. |
| FR-19 | Let managers reschedule/cancel tasks and inspect assignment and status-transition history. | **Partial.** Managers can list tasks and inspect their current assignment/status; task updates support status and notes with version checks. Rescheduling, cancellation, reassignment, and transition history are unavailable. |
| FR-20 | Configure crop/variety catalogs, production cycles, site assessments, planting material, plans, field execution, establishment, and stages. | **In progress.** The first-phase workflow is available, including approvals and manual task generation. Catalog lifecycle, stage automation, cycle reconciliation, and a unified audit trail remain incomplete. See the [crop-management audit](crop-management-requirements.md). |
| FR-21 | Configure regional planting windows and use them for annual or perennial crop planning. | **In progress.** Annual/perennial rules, suggestions, and cycle-window validation exist. Reusable templates, weather context, and automatic preparation/replanting tasks are not implemented. |
| FR-22 | Approve fertilizer plans and record planned products, doses, units, quantities, dates/recurrence, coverage, and actual applications. | **Implemented for the current workflow.** Farm product catalogs, approvals, idempotent recurrence tasks, partial applications, evidence, and follow-up are available. Inventory and cost controls are not. See [fertilization](fertilization.md). |
| FR-23 | Connect pest/disease observations, follow-up, intervention criteria, and approved treatment workflows to affected areas. | **Partial.** Structured inspections, catalog, follow-ups, manual preventive assignments, and treatments exist. Risk criteria and a formal treatment approval workflow do not. |
| FR-24 | Plan and execute irrigation; record moisture, sources, quality, infrastructure, balances, maintenance, and sensor checks. | **Implemented for operational records.** Includes recurring schedules and idempotent occurrence generation. Approval, weather integration, complete hydraulic mapping, and some administrative permission policies remain gaps. See [water management](water-management.md). |
| FR-25 | Store soil/foliar results and use them as context for reviewed agronomic plans. | **Partial.** Structured nutrients, configurable profiles, provisional interpretation, technical review, and plan linkage exist. Lab integration, method-aware confidence, and recommendations do not. |
| FR-26 | Plan harvest work and record harvested quantities, quality, and yield against a target and period. | **Partial.** Editable structured harvest records link to field/block/row and crop cycle with quantities, units, quality, rejection, and variance. Separate harvest planning and bunch-level traceability are missing. |
| FR-27 | Generate work from approved plans, recurrence, crop stages, and observations without duplicates. | **Partial.** Fertilizer and irrigation occurrence generation is idempotent; planting tasks can be generated manually from approved plans. Calendar/stage-driven crop work and observation alerts are not implemented. |
| FR-28 | Notify workers and supervisors about assignments, overdue tasks, and blockers. | **Planned.** Sensor threshold alerts exist, but task notifications and external delivery channels do not. |
| FR-29 | Capture field work offline and synchronize it later with visible status and conflict handling. | **Planned.** The frontend is not an offline-first/PWA client; demo browser storage is not synchronization. |

### Event types

`/api/v1/events` supports these historical record types:

| Type | Use |
| --- | --- |
| `SCOUTING_OBSERVATION` | Crop inspection or suspected pest/disease observation |
| `TREATMENT_APPLICATION` | Treatment activity |
| `FERTILIZER_APPLICATION` | Fertilization activity |
| `IRRIGATION_EVENT` | Irrigation activity |
| `HANDLING_EVENT` | Crop handling activity |
| `SOIL_SAMPLE` | Soil sampling activity |
| `HARVEST_EVENT` | Legacy/general harvest activity |

Structured harvest is stored separately as a `HARVEST` monitoring record linked
to a crop cycle. Generic event history remains available for compatibility.

## Non-functional requirements

The following target values are proposals only. They need agreement against
deployment budget, expected farms/users, data volumes, and operating conditions.

| ID | Requirement | Evidence and remaining work | Status |
| --- | --- | --- | --- |
| NFR-01 | Protect credentials and authenticated sessions. | BCrypt password hashes, HTTP-only same-site cookies, CSRF protection, login session/token rotation, and an eight-hour idle timeout exist. Production needs HTTPS/secure cookies; abuse protection, recovery, and verification are missing. | **Partial** |
| NFR-02 | Enforce farm-level data and role isolation on every operation. | Membership and role checks are used across the current APIs and cross-farm cases have automated coverage. Some domain-specific management permission policies remain incomplete. | **Partial** |
| NFR-03 | Preserve data integrity and atomic writes. | Database constraints, transactions, validation, and version checks protect selected workflows. Broader geometry, measurement, plant-range, and cross-module integrity rules need definition and coverage. | **Partial** |
| NFR-04 | Keep common worker operations responsive under expected load. | No load benchmark exists. Proposed target: p95 ≤ 2 seconds for login, daily-task listing, and task submission with 50 concurrent active users on a documented deployment, excluding file transfer. | **Proposed target** |
| NFR-05 | Bound resource use as agricultural history grows. | Spatial and relation/time indexes exist. Collection endpoints are not consistently paginated, and representative growth/load benchmarks are absent. | **Partial** |
| NFR-06 | Provide predictable service availability. | `/actuator/health` exists; uptime is not measured and no highly available deployment is configured. Proposed target: 99.5% monthly availability after measurement and operating rules are agreed. | **Proposed target** |
| NFR-07 | Recover agricultural data after infrastructure failure. | Docker persists a local database volume but does not provide backup. Scheduled backups and restore exercises are not configured. Proposed starting targets: RPO ≤ 24 hours and RTO ≤ 4 hours. | **Partial** |
| NFR-08 | Preserve or clearly recover worker sessions during deployment. | Sessions use the API process's in-memory store and disappear on restart. Multiple API instances require shared sessions or a deliberate reauthentication strategy. | **Partial** |
| NFR-09 | Avoid duplicate work and stale concurrent updates. | Version checks reject stale task and domain edits; recurring fertilizer and irrigation generation are idempotent. General request idempotency and offline conflict resolution are missing. | **Partial** |
| NFR-10 | Record accountable operational history. | Events and workflow records retain authors and timestamps; selected decisions are versioned. A unified immutable audit log for sign-in, membership, edits, deletion, and all workflow transitions is missing. | **Partial** |
| NFR-11 | Make failures diagnosable and API errors predictable. | Health reporting, application logging, and authentication/access status codes exist. Standard error bodies, correlation IDs, service metrics, and alerting are incomplete. | **Partial** |
| NFR-12 | Keep changes maintainable and verifiable. | Domain packages, Flyway migrations, Gradle wrapper, OpenAPI, backend tests, frontend unit tests, and Playwright workflows exist. CI enforcement and consistent coverage of each new workflow remain to be established. | **Partial** |
| NFR-13 | Support understandable, accessible field workflows. | The Spanish UI is responsive and includes labeled controls and keyboard-accessible dialogs; desktop/mobile browser flows are tested. Worker usability research and a full accessibility audit remain outstanding. | **Partial** |
| NFR-14 | Handle dates, time zones, and units consistently. | Events use instants, task/planting workflows use dates and times, and many domain measurements carry explicit units. Farm time zones and broader unit-pair validation are missing. | **Partial** |
| NFR-15 | Deploy reproducibly with environment-specific configuration. | Docker Compose, Flyway, and Spring environment overrides support local setup. Production packaging, secret management, deployment automation, and shared session storage are not supplied. | **Partial** |
| NFR-16 | Minimize and protect personal and operational data. | Farm authorization is implemented and photo content is access-controlled in PostgreSQL. Retention, account deletion/export policy, backup access, and formal data lifecycle controls remain undefined. | **Partial** |

No performance, availability, accessibility, recovery, or security certification
is implied by the implementation or automated tests. Production targets must be
measured and accepted against a defined deployment.

## Authorization model

Roles are assigned independently for each farm. The broad responsibilities are:

| Role | Current responsibility |
| --- | --- |
| `ADMIN` | Manage farm membership and roles; administer farm operations. |
| `SUPERVISOR` | Manage field work and operational workflows within the farm. |
| `AGRONOMIST` | Use agronomic configuration, review, and approval workflows; does not administer team membership. |
| `WORKER` | Read permitted farm information, execute assigned work, and submit field records allowed by the module. |

This is not a substitute for endpoint authorization. Exact create, edit, review,
and delete permissions vary by module and are enforced by the API. The module
docs and tests are authoritative for each workflow; the remaining gaps are
tracked in FR-05 and the module audits.

## Related documentation

- [Repository overview and local setup](../README.md)
- [Crop-management requirements and endpoint inventory](crop-management-requirements.md)
- [Fertilization workflow and limits](fertilization.md)
- [Water-management workflow and API](water-management.md)
- [Applied agronomic guidance](guias-agronomicas-aplicadas.md)
