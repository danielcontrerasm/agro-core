# Casos automatizados ejecutados

Listado de casos de la [regresión de sanidad del 26 de noviembre de 2026](../test-results.md#regresión-de-sanidad-del-26-de-noviembre-de-2026).
Los nombres corresponden a los del código para que se puedan localizar en el
informe. Los recorridos visuales y las capturas de cada paso están en la
[galería de QA](README.md).

## Playwright

| Caso | Prueba | Escritorio | Móvil |
| --- | --- | --- | --- |
| all dashboard views render without script errors or horizontal page overflow | [app.spec.ts](../../frontend/tests/app.spec.ts#L5) | Aprobado | Aprobado |
| demo task goes through execution, review and approval and persists after reload | [app.spec.ts](../../frontend/tests/app.spec.ts#L56) | Aprobado | Aprobado |
| harvest records can be viewed and edited from the history | [app.spec.ts](../../frontend/tests/app.spec.ts#L20) | Aprobado | Aprobado |
| map controls, block selection and layer comparison are interactive | [app.spec.ts](../../frontend/tests/app.spec.ts#L35) | Aprobado | Aprobado |
| new demo field is validated and saved locally | [app.spec.ts](../../frontend/tests/app.spec.ts#L71) | Aprobado | Aprobado |
| real login refreshes CSRF, loads API data and never substitutes demo tasks | [app.spec.ts](../../frontend/tests/app.spec.ts#L133) | Aprobado | Aprobado |
| report export includes only the filtered events | [app.spec.ts](../../frontend/tests/app.spec.ts#L115) | Aprobado | Aprobado |
| restoring a connected session shows only backend data and counts blocked tasks | [app.spec.ts](../../frontend/tests/app.spec.ts#L164) | Aprobado | Aprobado |
| sanitary catalog can add, edit and deactivate a problem | [app.spec.ts](../../frontend/tests/app.spec.ts#L96) | Aprobado | Aprobado |
| worker role hides management controls and narrows daily tasks | [app.spec.ts](../../frontend/tests/app.spec.ts#L86) | Aprobado | Aprobado |
| connected farm administration saves inventory, finances, crews and attendance | [farm-administration-live.spec.ts](../../frontend/tests/farm-administration-live.spec.ts#L9) | Aprobado | Aprobado |
| live workers load analyses without manager-only requests and submit CSRF-protected samples | [fertilization.spec.ts](../../frontend/tests/fertilization.spec.ts#L90) | Aprobado | Aprobado |
| nutrient map keeps each nutrient distinct and shows provisional interpretation | [fertilization.spec.ts](../../frontend/tests/fertilization.spec.ts#L76) | Aprobado | Aprobado |
| soil results, approved plan, task, partial application, evidence and followup persist | [fertilization.spec.ts](../../frontend/tests/fertilization.spec.ts#L3) | Aprobado | Aprobado |
| live map displays seven fields without observations and identifies the test plan | [field-map.spec.ts](../../frontend/tests/field-map.spec.ts#L3) | Aprobado | Aprobado |
| connected monitoring persists schedules and threshold reviews in PostGIS | [inspection-monitoring.spec.ts](../../frontend/tests/inspection-monitoring.spec.ts#L89) | Aprobado | Aprobado |
| periodic inspections advance the demo schedule and preserve threshold decisions | [inspection-monitoring.spec.ts](../../frontend/tests/inspection-monitoring.spec.ts#L84) | Aprobado | Aprobado |
| inspection persists, computes incidence and updates the health map after review | [inspections.spec.ts](../../frontend/tests/inspections.spec.ts#L4) | Aprobado | Aprobado |
| legacy observations and treatment entry remain accessible in the health workspace | [inspections.spec.ts](../../frontend/tests/inspections.spec.ts#L101) | Aprobado | Aprobado |
| treatments, evidence, follow-ups, CSV and annulment preserve the inspection history | [inspections.spec.ts](../../frontend/tests/inspections.spec.ts#L47) | Aprobado | Aprobado |
| estimated executions subtract interruptions and require explanation for overruns | [irrigation.spec.ts](../../frontend/tests/irrigation.spec.ts#L67) | Aprobado | Aprobado |
| live worker records a unit-aware reading without requesting management permissions | [irrigation.spec.ts](../../frontend/tests/irrigation.spec.ts#L189) | Aprobado | Aprobado |
| recurring irrigation schedules generate occurrences and can be paused and resumed | [irrigation.spec.ts](../../frontend/tests/irrigation.spec.ts#L144) | Aprobado | Aprobado |
| sector, manual reading, programming, measured partial execution, photos and followup persist | [irrigation.spec.ts](../../frontend/tests/irrigation.spec.ts#L3) | Aprobado | Aprobado |
| water management records can be edited from each management table | [irrigation.spec.ts](../../frontend/tests/irrigation.spec.ts#L90) | Aprobado | Aprobado |
| water usage report compares plans, execution origins, rainfall and deficits | [irrigation.spec.ts](../../frontend/tests/irrigation.spec.ts#L175) | Aprobado | Aprobado |
| harvest does not show demo records when the live harvest request fails | [live-api.spec.ts](../../frontend/tests/live-api.spec.ts#L4) | Aprobado | Aprobado |
| real server onboarding and agricultural record creation | [live-api.spec.ts](../../frontend/tests/live-api.spec.ts#L35) | Aprobado | Aprobado |
| connected dashboard and maps reflect backend records and unavailable data | [live-dashboard-map.spec.ts](../../frontend/tests/live-dashboard-map.spec.ts#L3) | Aprobado | Aprobado |
| live task creation targets a field, persists across reloads and saves workflow notes | [live-tasks.spec.ts](../../frontend/tests/live-tasks.spec.ts#L4) | Aprobado | Aprobado |
| live worker cannot create or approve tasks | [live-tasks.spec.ts](../../frontend/tests/live-tasks.spec.ts#L68) | Aprobado | Aprobado |
| recorrido manual: finca, lote, riego, fertilización y cosecha | [manual-agricultural-workflow.spec.ts](../../frontend/tests/manual-agricultural-workflow.spec.ts#L124) | Aprobado | — |
| event photos preview, enlarge, download and persist in demo and are removed with the event | [photos.spec.ts](../../frontend/tests/photos.spec.ts#L15) | Aprobado | Aprobado |
| inspection photos can target a treatment and remain viewable after annulment | [photos.spec.ts](../../frontend/tests/photos.spec.ts#L47) | Aprobado | Aprobado |
| live photo upload sends multipart with CSRF and previews authenticated content | [photos.spec.ts](../../frontend/tests/photos.spec.ts#L75) | Aprobado | Aprobado |
| creates, completes and documents a preventive assignment in demo mode | [preventive.spec.ts](../../frontend/tests/preventive.spec.ts#L3) | Aprobado | Aprobado |
| connected treatment follow-up records execution against the original inspection and reloads the outcome | [treatment-followups.spec.ts](../../frontend/tests/treatment-followups.spec.ts#L71) | Aprobado | Aprobado |
| demo treatment follow-up persists authorization, worker execution and agronomic verification | [treatment-followups.spec.ts](../../frontend/tests/treatment-followups.spec.ts#L45) | Aprobado | Aprobado |

## Unitarias del frontend

Aprobaron los 11 casos de [dominio](../../frontend/src/lib/domain.test.ts).

- inspection incidence rejects invalid samples and health respects resolution, freshness and target
- inspection CSV exports history and cancellation reasons with spreadsheet protection
- farm scoping includes row-linked events and excludes foreign farm records
- area is counted once and plant estimates come only from the scoped rows
- daily work contains overdue unfinished tasks but excludes old completed, review and future tasks
- task transitions require execution and supervisor review before completion
- a blocker requires a reason and a blocked task can be resumed
- CSV cells escape quotes and neutralize spreadsheet formula prefixes
- local dates use the device calendar rather than a UTC day conversion
- nutrient interpretation classifies only compatible results and keeps review required
- analysis interpretation reports attention and unknown results without prescribing a dose

## Gradle y API

Los siguientes 60 casos aprobaron en H2 o PostGIS, según la clase.

### AgriculturalApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/AgriculturalApiTest.java)

- `listsSensorAlertsWithAndWithoutAStatusFilter`
- `locationsEventsObservationsAndMediaRoundTripAsUsableJson`

### AuthIntegrationTest

[Prueba de backend](../../src/test/java/com/yourco/agro/AuthIntegrationTest.java)

- `farmAndFieldListsOnlyReturnMembershipData`
- `eventCreatorComesFromLoginAndForeignTargetsAreRejected`
- `loginRotatesSessionIdAndCsrfToken`
- `loginReturnsFarmRoleAndLogoutRevokesSession`
- `invalidLoginAndMissingCsrfAreRejected`
- `onlyAdminCanAssignMembershipsAndCannotDemoteSelf`
- `farmCreatorReceivesAdminMembership`
- `registerNormalizesEmailAndNeverReturnsOrStoresPlaintextPassword`
- `workerCannotManageFarmOrAccessAnotherFarmsResources`

### AuthPostgresTest

[Prueba de backend](../../src/test/java/com/yourco/agro/AuthPostgresTest.java)

- `agronomistCanConfigureRegionalCalendarWithoutTeamAdministration`
- `ownerCanAssignAndChangeRolesWithImmediateEffectOnExistingSessions`

### FertilizationApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/FertilizationApiTest.java)

- `approvalIsVersionedAndTaskGenerationIsIdempotent`
- `productCatalogAndRecurringPlansGenerateIdempotentOccurrences`
- `agronomistCanCreateProfileAndReviewAnalysis`
- `validatesUnitsCoordinatesDatesAndFarmIsolation`
- `reportsAreAuthenticatedAndFollowupsValidateBlockAndTime`
- `unitConversionsAndCancellationPreserveApprovalAudit`
- `partialApplicationsAreAtomicAuthorizedAndLinkedToEvents`

### FertilizationPostgresTest

[Prueba de backend](../../src/test/java/com/yourco/agro/FertilizationPostgresTest.java)

- `persistsApprovedPlanApplicationsAndLatestSampleInPostgis`

### FinanceApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/FinanceApiTest.java)

- `restrictsFinancialReadsAndWritesAndRejectsForeignBlocks`
- `computesMonthlyTotalsAndMarginsInCopAndUpsertsBudget`

### GeometryJsonTest

[Prueba de backend](../../src/test/java/com/yourco/agro/GeometryJsonTest.java)

- `preservesPolygonRingsAndCanBeReadAsCompleteJson`
- `serializesPointAndLineAsBoundedGeoJsonRatherThanRecursiveGeometryProperties`

### InspectionApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/InspectionApiTest.java)

- `followUpMustPreserveProblemAndLocationAndKeepsParentLink`
- `roundTripFiltersReviewPermissionsAndStaleVersion`
- `mapSeparatesMissingStaleActiveAndResolvedInspections`
- `treatmentsAndEvidenceRemainLinkedAndRespectFarmAccess`
- `rejectsInvalidCountsMethodsTargetsAndMissingCsrf`
- `cancellationRequiresManagerReasonAndVersionAndPreservesHistory`
- `sanitaryCatalogCanBeManagedWithoutDeletingHistory`

### InspectionMonitoringApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/InspectionMonitoringApiTest.java)

- `rejectsUnscopedWritesDuplicatesAndInvalidRules`
- `persistsInclusiveThresholdAndTechnicalDecisionWithoutRetroactiveAlerts`
- `matchesValidVisitsByBlockAndProblemAndReevaluatesAnAnnulledVisit`

### InventoryApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/InventoryApiTest.java)

- `concurrentWithdrawalsNeverExceedTheLotBalance`
- `computesAvailableAndPhysicalBalancesFromFarmLotsAndEnforcesAccess`

### IrrigationApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/IrrigationApiTest.java)

- `tasksAreIdempotentAndExecutionsNormalizeLitersAndPreventOverlap`
- `sectorsMeasurementsAndThresholdsRespectPermissionsAndUnits`
- `managementRecordsCanBeUpdatedWithVersionAndFarmIsolation`
- `recurringSchedulesGenerateIdempotentPlansAndSupportStateChanges`
- `cancellationAndInvalidCounterCannotCreateEvents`
- `estimatedConsumptionSubtractsInterruptionsAndOverrunsRequireExplanation`
- `sensorReadingsUseDeclaredProfileAndStaleReadingsAreNotCurrent`

### IrrigationPostgresTest

[Prueba de backend](../../src/test/java/com/yourco/agro/IrrigationPostgresTest.java)

- `migrationExecutionsAndMapPreserveUnitsAndProvenance`
- `waterUsageReportComparesPlannedActualOriginsAndBalanceContext`

### PhotoApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/PhotoApiTest.java)

- `eventPhotoRoundTripIncludesAuthenticatedPreviewAndDownload`
- `uploadRejectsForeignTargetsInvalidImagesAmbiguousTargetsAndMissingCsrf`
- `inspectionAndTreatmentPhotosKeepTheirTargetAndSurviveAnnulment`

### PreventiveMeasureApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/PreventiveMeasureApiTest.java)

- `templatesAssignmentsCompletionAndEvidenceRespectAccess`
- `validatesFarmOwnershipAndCompletionNotes`

### SmokeTest

[Prueba de backend](../../src/test/java/com/yourco/agro/SmokeTest.java)

- `contextLoads`

### TaskApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/TaskApiTest.java)

- `fieldAndBlockTasksPersistAndWorkersOnlySeeTheirOwnAssignments`
- `creationEnforcesMembershipLocationValidationAndCsrf`
- `workflowRequiresNotesAndManagerApprovalAndRejectsStaleUpdates`

### TreatmentFollowupApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/TreatmentFollowupApiTest.java)

- `authorizesExecutesAndVerifiesWithLotAndRetainsEvidenceAndLegacyRecords`
- `restrictsWritesAndKeepsCanceledInspectionHistoryReadable`
- `enforcesVersionChronologyAndOptionalProductRules`

### WorkforceApiTest

[Prueba de backend](../../src/test/java/com/yourco/agro/WorkforceApiTest.java)

- `assignsCrewsOnlyToFarmMembersAndShowsWorkersTheirOwnCrew`
- `recordsDailyAttendanceAndEnforcesPermissionsAndVersions`
