import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, farmMetrics, localDate, scopeFarm, todayTasks, transitionTask } from './domain.ts';
import type { FarmData, Task } from './types.ts';
import { demoInspections, incidence, inspectionCsv, inspectionHealth } from './inspections.ts';
import { interpretAnalysis, interpretNutrient } from './fertilization.ts';

test('inspection incidence rejects invalid samples and health respects resolution, freshness and target', () => {
  assert.equal(incidence(20, 5), 25);
  assert.throws(() => incidence(0, 0));
  assert.throws(() => incidence(20, 21));
  const records = demoInspections();
  assert.equal(inspectionHealth(records, 1), 'ACTIVE_FINDINGS');
  assert.equal(inspectionHealth(records, 2), 'NO_ACTIVE_FINDINGS');
  assert.equal(inspectionHealth(records, 3), 'NO_RECENT_INSPECTION');
  assert.equal(inspectionHealth(records, 5), 'NO_RECENT_INSPECTION');
  const resolved = records.map(record => ({ ...record, resolved: true }));
  assert.equal(inspectionHealth(resolved, 1), 'NO_ACTIVE_FINDINGS');
  assert.equal(inspectionHealth(records.map(record => ({ ...record, canceledAt: new Date().toISOString() })), 1), 'NO_RECENT_INSPECTION');
  const otherProblem = { ...records[2], id: 99, problemCode: 'OTHER', inspectedAt: new Date().toISOString(), affectedPlants: 0 };
  assert.equal(inspectionHealth([...records, otherProblem], 3), 'NO_RECENT_INSPECTION');
});

test('inspection CSV exports history and cancellation reasons with spreadsheet protection', () => {
  const record = { ...demoInspections()[0], symptoms: '=SUM(1,2)', cancellationReason: 'Duplicado "verificado"', canceledAt: '2026-01-01T00:00:00Z' };
  const content = inspectionCsv([record], () => 'Bloque A', () => 'Surco 1');
  assert.ok(content.startsWith('\uFEFF'));
  assert.ok(content.includes("'" + '=SUM(1,2)'));
  assert.ok(content.includes('Duplicado ""verificado""'));
  assert.ok(content.includes('Anulada UTC'));
});

const farm = { id: 1, name: 'North' };
const foreignFarm = { id: 2, name: 'South' };
const field = { id: 10, name: 'Field', farm, areaHa: 15 };
const foreignField = { id: 20, name: 'Foreign field', farm: foreignFarm, areaHa: 99 };
const block = { id: 100, code: 'A', field, crop: 'banana', areaHa: 15 };
const foreignBlock = { id: 200, code: 'B', field: foreignField, crop: 'banana', areaHa: 99 };
const row = { id: 1000, rowCode: 'R-1', block, plantsEstimated: 150 };
const data: FarmData = {
  farms: [farm, foreignFarm], fields: [field, foreignField], blocks: [block, foreignBlock],
  rows: [row, { ...row, id: 2000, block: foreignBlock }],
  events: [
    { id: 1, eventType: 'SCOUTING_OBSERVATION', row, occurredAt: '2026-10-16T12:00:00Z', createdByUserId: 1 },
    { id: 2, eventType: 'IRRIGATION_EVENT', block: foreignBlock, occurredAt: '2026-10-16T12:00:00Z', createdByUserId: 2 },
  ],
};
const task: Task = { id: 'one', title: 'Inspect', activity: 'scouting', blockId: 100, date: '2026-10-16', time: '07:00', assignee: 'Daniel', priority: 'Alta', status: 'pending', instructions: 'Inspect the block' };

test('farm scoping includes row-linked events and excludes foreign farm records', () => {
  const result = scopeFarm(data, 1);
  assert.deepEqual(result.farms, [farm]); assert.deepEqual(result.fields, [field]);
  assert.deepEqual(result.blocks, [block]); assert.deepEqual(result.rows, [row]);
  assert.deepEqual(result.events.map(event => event.id), [1]);
  assert.deepEqual(scopeFarm(data, 999), { farms: [], fields: [], blocks: [], rows: [], events: [] });
});

test('area is counted once and plant estimates come only from the scoped rows', () => {
  assert.deepEqual(farmMetrics(scopeFarm(data, 1)), { area: 15, plants: 150, observations: 1, events: 1 });
});

test('daily work contains overdue unfinished tasks but excludes old completed, review and future tasks', () => {
  const tasks = [task, { ...task, id: 'overdue', date: '2026-10-15' }, { ...task, id: 'done', date: '2026-10-15', status: 'completed' as const }, { ...task, id: 'review', date: '2026-10-15', status: 'review' as const }, { ...task, id: 'future', date: '2026-10-17' }, { ...task, id: 'other', assignee: 'María' }];
  assert.deepEqual(todayTasks(tasks, '2026-10-16', 'Daniel').map(item => item.id), ['overdue', 'one']);
});

test('task transitions require execution and supervisor review before completion', () => {
  assert.throws(() => transitionTask(task, 'completed'));
  const started = transitionTask(task, 'progress');
  const submitted = transitionTask(started, 'review', 'Finished inspection');
  const approved = transitionTask(submitted, 'completed');
  assert.equal(approved.status, 'completed'); assert.equal(approved.notes, 'Finished inspection');
  assert.throws(() => transitionTask(approved, 'progress'));
});

test('a blocker requires a reason and a blocked task can be resumed', () => {
  assert.throws(() => transitionTask(task, 'blocked', '  '));
  const blocked = transitionTask(task, 'blocked', ' Waiting for equipment ');
  assert.equal(blocked.notes, 'Waiting for equipment');
  assert.equal(transitionTask(blocked, 'progress').status, 'progress');
});

test('CSV cells escape quotes and neutralize spreadsheet formula prefixes', () => {
  assert.equal(csvCell('A "quoted" field'), '"A ""quoted"" field"');
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('@command'), '"\'@command"'); assert.equal(csvCell(null), '""');
  assert.equal(csvCell('  =SUM(A1)'), '"\'  =SUM(A1)"');
});

test('local dates use the device calendar rather than a UTC day conversion', () => {
  assert.equal(localDate(new Date(2026, 9, 16, 23, 59)), '2026-10-16');
});

test('nutrient interpretation classifies only compatible results and keeps review required', () => {
  const low = interpretNutrient({ nutrient: 'K', value: 0.2, unit: 'CMOL_KG', method: 'Acetato' }, 'banana');
  assert.equal(low.status, 'LOW');
  assert.equal(low.label, 'Bajo');
  assert.equal(low.requiresTechnicalReview, true);

  const adequate = interpretNutrient({ nutrient: 'K', value: 0.4, unit: 'CMOL_KG', method: 'Acetato' }, 'banano');
  assert.equal(adequate.status, 'ADEQUATE');
  assert.equal(adequate.label, 'En rango');

  const unknownUnit = interpretNutrient({ nutrient: 'K', value: 40, unit: 'MG_KG', method: 'Acetato' }, 'banana');
  assert.equal(unknownUnit.status, 'UNKNOWN');
  assert.match(unknownUnit.reason, /rango compatible/);

  const foliar = interpretNutrient({ nutrient: 'K', value: 0.2, unit: 'CMOL_KG', method: 'Acetato' }, 'banana', 'FOLIAR');
  assert.equal(foliar.status, 'UNKNOWN');
});

test('analysis interpretation reports attention and unknown results without prescribing a dose', () => {
  const summary = interpretAnalysis({
    id: 1, blockId: 1, sampleType: 'SOIL', sampledOn: '2026-10-16', laboratory: 'Lab', reference: 'S-1', depthCm: 20,
    results: [
      { nutrient: 'N', value: 0.1, unit: 'PERCENT', method: 'Total' },
      { nutrient: 'P', value: 20, unit: 'MG_KG', method: 'Bray' },
      { nutrient: 'ZN', value: 2, unit: 'MG_KG', method: 'DTPA' },
    ], createdBy: 1,
  }, 'banana');
  assert.equal(summary.low, 1);
  assert.equal(summary.adequate, 2);
  assert.equal(summary.high, 0);
  assert.equal(summary.unknown, 0);
  assert.equal(summary.attention, 1);
});
