import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Download, Droplets, Sprout, Bug, Wheat, ClipboardList, ArrowUpRight, CalendarDays, MapPin, Trash2, Image, ExternalLink, Check, FileText, Leaf, FlaskConical, Sparkles, ArrowRight, Search, Eye, Pencil } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { csvCell, eventLabels, localDate, number, statusLabels } from '../lib/domain';
import { demoAnalytics, readDemo, saveDemo } from '../lib/demo';
import type { AnalyticsLayer, FieldEvent, Page } from '../lib/types';
import { Badge, Donut, Empty, Loading, Modal, Notice, Panel } from '../components/ui';
import { EventForm } from '../components/Forms';
import { EventIcon } from './Dashboard';
import Inspections from './Inspections';
import PhotoGallery from '../components/PhotoGallery';
import FarmMap from '../components/FarmMap';
import Fertilization from './Fertilization';
import Irrigation from './Irrigation';
import PreventiveMeasures from './PreventiveMeasures';
import { readPlantingDemo, type Cycle } from '../lib/planting';
import { demoProduction, productionKey, productionUnits, qualityGrades, readProductionDemo, saveProductionDemo, type ProductionRecord } from '../lib/production';
import { readIrrigationDemo, withIrrigation } from '../lib/irrigation';
import { readFertilizationDemo, withSoilAnalyses } from '../lib/fertilization';
import { demoInspections, healthLabels, inspectionDemoKey, withInspectionHealth } from '../lib/inspections';
import { demoWaterUsageReport, summarizeWaterUsage, type WaterUsageReport } from '../lib/analytics';

const modules = {
  irrigation: { title: 'Riego', subtitle: 'El agua correcta, en el lugar correcto.', eyebrow: 'CUIDA CADA GOTA', type: 'IRRIGATION_EVENT', icon: Droplets, color: 'blue', activity: 'irrigation' },
  fertilization: { title: 'Fertilización', subtitle: 'Nutrir el suelo es invertir en lo que viene.', eyebrow: 'LA BASE DE UN CULTIVO FUERTE', type: 'FERTILIZER_APPLICATION', icon: Sprout, color: 'green', activity: 'fertilization' },
  disease: { title: 'Plagas y enfermedades', subtitle: 'Observa a tiempo. Acompaña cada cambio de tu cultivo.', eyebrow: 'LA PREVENCIÓN EMPIEZA EN EL CAMPO', type: 'SCOUTING_OBSERVATION', icon: Bug, color: 'orange', activity: 'scouting' },
  harvest: { title: 'Cosecha', subtitle: 'El resultado del cuidado de cada día.', eyebrow: 'EL FRUTO DE TU TRABAJO', type: 'HARVEST_EVENT', icon: Wheat, color: 'gold', activity: 'harvest' },
};

export default function Operations({ page }: { page: Page }) {
  return page === 'disease' ? <HealthWorkspace /> : page === 'fertilization' ? <FertilizationWorkspace /> : page === 'irrigation' ? <IrrigationWorkspace /> : page === 'harvest' ? <HarvestWorkspace /> : page === 'insights' ? <AgronomicCenter /> : <OperationsHistory page={page} />;
}

function IrrigationWorkspace() {
  const [legacy, setLegacy] = useState(false);
  return legacy ? <>
    <button className="button secondary module-back-button" onClick={() => setLegacy(false)}>Volver a Riego</button>
    <OperationsHistory page="irrigation" />
  </> : <Irrigation onHistory={() => setLegacy(true)} />;
}

function FertilizationWorkspace() {
  const [legacy, setLegacy] = useState(false);
  return legacy ? <>
    <button className="button secondary module-back-button" onClick={() => setLegacy(false)}>Volver a Fertilización</button>
    <OperationsHistory page="fertilization" />
  </> : <Fertilization onHistory={() => setLegacy(true)} />;
}

function reportStartDate() { const date = new Date(); date.setDate(date.getDate() - 29); return localDate(date); }
function reportPercent(value: number | null) { return value == null ? 'Sin plan' : `${number(value, 1)}%`; }

function WaterUsageAnalyticsPanel() {
  const { mode, farmId, data, notify } = useApp();
  const [from, setFrom] = useState(reportStartDate);
  const [until, setUntil] = useState(localDate);
  const [sectorFilter, setSectorFilter] = useState('all');
  const [report, setReport] = useState<WaterUsageReport>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!from || !until || from > until) { setError('Selecciona un periodo válido.'); setLoading(false); return; }
    let active = true;
    setLoading(true); setError('');
    const load = async () => {
      try {
        const result = mode === 'demo' ? demoWaterUsageReport(readIrrigationDemo(), data.blocks, from, until) : await api.waterUsageAnalytics(farmId, from, until);
        if (active) setReport(result);
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar el consumo de agua.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [data.blocks, farmId, from, mode, until]);

  const sectors = useMemo(() => report?.sectors.filter(sector => sectorFilter === 'all' || sectorFilter === `sector:${sector.sectorId}` || sectorFilter === `block:${sector.blockId}`) ?? [], [report, sectorFilter]);
  const blockOptions = useMemo(() => Array.from(new Map((report?.sectors ?? []).map(sector => [sector.blockId, sector.blockCode])).entries()), [report]);
  const summary = useMemo(() => summarizeWaterUsage(sectors), [sectors]);

  function clearFilters() { setFrom(reportStartDate()); setUntil(localDate()); setSectorFilter('all'); }
  function exportCsv() {
    if (!report) return;
    const records = [['Sector', 'Bloque', 'Área (ha)', 'Planificado (m³)', 'Aplicado (m³)', 'Medido (m³)', 'Estimado (m³)', 'Lluvia (mm)', 'Requerido (m³)', 'Déficit (mm)', 'Humedad promedio', 'Cumplimiento (%)'], ...sectors.map(sector => [sector.sectorName, sector.blockCode, sector.areaHa, sector.plannedVolumeM3, sector.actualVolumeM3, sector.measuredVolumeM3, sector.estimatedVolumeM3, sector.rainfallMm, sector.requiredVolumeM3, sector.deficitMm, sector.moistureAverage == null ? '' : `${sector.moistureAverage} ${sector.moistureUnit ?? ''}`, sector.coveragePercent ?? ''])];
    const content = '\uFEFF' + records.map(record => record.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `agrovision-${mode === 'demo' ? 'demo-' : ''}consumo-agua-${from}-${until}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exportados ${sectors.length} sectores${mode === 'demo' ? ' de demostración' : ''}.`);
  }

  return <Panel title="Consumo y balance de agua" action={<div className="water-report-actions"><Badge tone="blue">{from} → {until}</Badge><button className="button secondary small" onClick={exportCsv} disabled={loading || !sectors.length}><Download size={14} />Exportar consumo</button></div>} className="water-analytics-panel">
    <Notice>Compara el volumen planificado con la ejecución real y separa consumos medidos por contador de estimaciones por caudal. La lluvia y el déficit provienen de los balances registrados; no son una recomendación automática.</Notice>
    <div className="record-filters water-report-filters"><label>Desde<input aria-label="Consumo desde" type="date" value={from} onChange={event => setFrom(event.target.value)} max={until || undefined} /></label><label>Hasta<input aria-label="Consumo hasta" type="date" value={until} onChange={event => setUntil(event.target.value)} min={from || undefined} /></label><label>Sector o bloque<select aria-label="Filtrar sector o bloque" value={sectorFilter} onChange={event => setSectorFilter(event.target.value)}><option value="all">Todos</option><optgroup label="Bloques">{blockOptions.map(([blockId, blockCode]) => <option key={`block:${blockId}`} value={`block:${blockId}`}>{blockCode}</option>)}</optgroup><optgroup label="Sectores">{(report?.sectors ?? []).map(sector => <option key={`sector:${sector.sectorId}`} value={`sector:${sector.sectorId}`}>{sector.sectorName} · {sector.blockCode}</option>)}</optgroup></select></label>{(sectorFilter !== 'all' || from !== reportStartDate() || until !== localDate()) && <button className="text-button" onClick={clearFilters}>Limpiar</button>}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <Loading /> : <><div className="water-analytics-kpis"><div><span>Planificado</span><strong>{number(summary.plannedVolumeM3, 2)} m³</strong><small>{summary.plannedPlanCount} planes</small></div><div><span>Aplicado</span><strong>{number(summary.actualVolumeM3, 2)} m³</strong><small>{summary.executedPlanCount} planes ejecutados</small></div><div><span>Medido</span><strong>{number(summary.measuredVolumeM3, 2)} m³</strong><small>{summary.meteredExecutionCount} ejecuciones</small></div><div><span>Estimado</span><strong>{number(summary.estimatedVolumeM3, 2)} m³</strong><small>{summary.estimatedExecutionCount} ejecuciones</small></div><div><span>Lluvia acumulada</span><strong>{number(summary.rainfallMm, 1)} mm</strong><small>{summary.moistureReadingCount} lecturas de humedad</small></div><div><span>Déficit registrado</span><strong>{number(summary.deficitMm, 1)} mm</strong><small>{reportPercent(summary.balanceCoveragePercent)} del requerido aplicado en balance</small></div></div><div className="table-wrap water-report-table"><table><thead><tr><th>Sector / bloque</th><th>Planificado</th><th>Aplicado</th><th>Medido / estimado</th><th>Lluvia / requerido</th><th>Déficit</th><th>Humedad</th><th>Cumplimiento</th></tr></thead><tbody>{sectors.map(sector => <tr key={sector.sectorId}><td><strong>{sector.sectorName}</strong><small className="table-subtitle">{sector.blockCode} · {sector.areaHa == null ? 'Área sin dato' : `${number(sector.areaHa, 2)} ha`}</small></td><td>{number(sector.plannedVolumeM3, 2)} m³<small className="table-subtitle">{sector.plannedPlanCount} planes</small></td><td>{number(sector.actualVolumeM3, 2)} m³<small className="table-subtitle">{sector.executedPlanCount} planes ejecutados</small></td><td>{number(sector.measuredVolumeM3, 2)} / {number(sector.estimatedVolumeM3, 2)} m³<small className="table-subtitle">{sector.meteredExecutionCount} medido · {sector.estimatedExecutionCount} estimado</small></td><td>{number(sector.rainfallMm, 1)} mm<small className="table-subtitle">Requerido: {number(sector.requiredVolumeM3, 2)} m³</small></td><td>{number(sector.deficitMm, 1)} mm<small className="table-subtitle">{reportPercent(sector.balanceCoveragePercent)} del balance</small></td><td>{sector.moistureAverage == null ? 'Sin dato' : `${number(sector.moistureAverage, 2)} ${sector.moistureUnit ?? ''}`}<small className="table-subtitle">{sector.moistureReadingCount} lecturas</small></td><td>{reportPercent(sector.coveragePercent)}<small className="table-subtitle">Varianza: {sector.varianceM3 >= 0 ? '+' : ''}{number(sector.varianceM3, 2)} m³</small></td></tr>)}</tbody></table>{!sectors.length && <Empty title="Sin datos de consumo" description="No hay planes, ejecuciones o sectores para este periodo y filtro." />}</div><div className="table-pagination"><span>{sectors.length} sectores analizados</span><span>Aplicado = ejecuciones registradas; medido y estimado conservan el origen del volumen.</span></div></>}
  </Panel>;
}

function HealthWorkspace() {
  const [tab, setTab] = useState('inspections');
  const sections = [
    { id: 'inspections', label: 'Inspecciones' },
    { id: 'prevention', label: 'Prevención' },
    { id: 'history', label: 'Historial anterior y tratamientos' },
  ];
  const navigation = <div className="inspection-tabs" role="group" aria-label="Secciones fitosanitarias">
    {sections.map(section => <button key={section.id} aria-pressed={tab === section.id} onClick={() => setTab(section.id)}>{section.label}</button>)}
  </div>;
  return <div className="inspection-workspace">
    {tab === 'inspections' ? <Inspections navigation={navigation} /> : <>
      {navigation}
      {tab === 'prevention' ? <PreventiveMeasures /> : <OperationsHistory page="disease" />}
    </>}
  </div>;
}

type HarvestLocation = 'field' | 'block' | 'row';
type HarvestEditor = 'new' | ProductionRecord;

function HarvestWorkspace() {
  const { data, mode, farmId, search, notify, tasks, date, navigate } = useApp();
  const [records, setRecords] = useState<ProductionRecord[]>(() => readProductionDemo());
  const [cycles, setCycles] = useState<Cycle[]>(() => readPlantingDemo().cycles);
  const [loading, setLoading] = useState(mode === 'live');
  const [form, setForm] = useState<HarvestEditor | null>(null);
  const [selected, setSelected] = useState<ProductionRecord | null>(null);
  const [blockFilter, setBlockFilter] = useState(0);
  const [cycleFilter, setCycleFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSelected(null);
    setForm(null);
    setBlockFilter(0);
    setCycleFilter('all');
    setUnitFilter('all');
    const load = async () => {
      try {
        if (mode === 'live') {
          const [savedRecords, savedPlanting] = await Promise.all([api.productionRecords(farmId), api.planting(farmId)]);
          if (active) { setRecords(savedRecords); setCycles(savedPlanting.cycles); }
        } else if (active) {
          setRecords(readProductionDemo());
          setCycles(readPlantingDemo().cycles);
        }
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'No se pudieron cargar los registros de cosecha.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [farmId, mode]);

  const cycleById = useMemo(() => new Map(cycles.map(cycle => [cycle.id, cycle])), [cycles]);
  const matchingRecords = useMemo(() => records.filter(record => {
    const cycle = record.cropCycleId ? cycleById.get(record.cropCycleId) : undefined;
    const blockId = record.blockId ?? data.rows.find(row => row.id === record.rowId)?.block.id;
    const location = data.blocks.find(block => block.id === blockId);
    const text = `${record.crop ?? ''} ${record.variety ?? ''} ${cycle?.code ?? ''} ${record.notes ?? ''} ${location?.code ?? ''}`.toLocaleLowerCase('es');
    const inFarm = mode === 'live' || (record.rowId != null ? data.rows.some(row => row.id === record.rowId)
      : record.blockId != null ? Boolean(location) : record.fieldId == null || data.fields.some(field => field.id === record.fieldId));
    return inFarm && (cycleFilter === 'all' || String(record.cropCycleId ?? '') === cycleFilter) &&
      (unitFilter === 'all' || record.yieldUnit === unitFilter) && text.includes(search.toLocaleLowerCase('es'));
  }), [cycleById, cycleFilter, data.blocks, data.fields, data.rows, mode, records, search, unitFilter]);
  const filtered = blockFilter ? matchingRecords.filter(record =>
    (record.blockId ?? data.rows.find(row => row.id === record.rowId)?.block.id) === blockFilter) : matchingRecords;
  const summaryUnit = unitFilter === 'all' ? matchingRecords[0]?.yieldUnit : unitFilter;
  const summaryRecords = summaryUnit ? filtered.filter(record => record.yieldUnit === summaryUnit) : filtered;
  const total = (selector: (record: ProductionRecord) => number) => summaryRecords.reduce((sum, record) => sum + selector(record), 0);
  const unitLabel = productionUnits.find(unit => unit.value === summaryUnit)?.label ?? 'Sin unidad';

  function openNew() { setError(''); setSelected(null); setForm('new'); }
  function openView(record: ProductionRecord) { setError(''); setSelected(record); }
  function openEdit(record: ProductionRecord) { setError(''); setSelected(null); setForm(record); }

  async function saveRecord(payload: Record<string, unknown>, recordId?: number) {
    setBusy(true); setError('');
    try {
      let saved: ProductionRecord;
      if (mode === 'live') {
        saved = recordId ? await api.updateProductionRecord(recordId, payload) : await api.createProductionRecord(payload);
        setRecords(previous => recordId ? previous.map(record => record.id === recordId ? saved : record) : [saved, ...previous]);
      } else {
        const current = recordId ? records.find(record => record.id === recordId) : undefined;
        saved = { ...current, ...payload, id: recordId ?? Math.max(0, ...records.map(record => record.id)) + 1, recordType: 'HARVEST' } as ProductionRecord;
        const next = recordId ? records.map(record => record.id === recordId ? saved : record) : [saved, ...records];
        if (!saveProductionDemo(next)) throw new Error('No se pudo guardar la demostración en el navegador.');
        setRecords(next);
      }
      setForm(null); setSelected(null);
      notify(recordId ? 'Cosecha actualizada correctamente.' : mode === 'live' ? 'Cosecha registrada correctamente.' : 'Cosecha guardada en la demostración.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : recordId ? 'No se pudo actualizar la cosecha.' : 'No se pudo guardar la cosecha.');
    } finally { setBusy(false); }
  }

  const locationLabel = (record: ProductionRecord) => {
    const row = data.rows.find(item => item.id === record.rowId);
    const block = data.blocks.find(item => item.id === (record.blockId ?? row?.block.id));
    const field = data.fields.find(item => item.id === (record.fieldId ?? block?.field.id ?? row?.block.field.id));
    return [field?.name, block?.code, row?.rowCode].filter(Boolean).join(' · ') || 'Ubicación registrada';
  };

  const activities = tasks.filter(task => task.activity === 'harvest' && task.date >= date && task.status !== 'completed')
    .sort((first, second) => `${first.date}T${first.time}`.localeCompare(`${second.date}T${second.time}`)).slice(0, 4);
  const quality = qualityGrades.map(grade => ({ ...grade, count: filtered.filter(record => record.qualityGrade === grade.value).length }));
  const qualityColors = ['#188c4f', '#64ac58', '#e4b632', '#ed934b', '#d6443c'];
  const byBlock = new Map<number, number>();
  for (const record of matchingRecords) {
    const id = record.blockId ?? data.rows.find(row => row.id === record.rowId)?.block.id;
    if (id && record.yieldUnit === summaryUnit) byBlock.set(id, (byBlock.get(id) ?? 0) + Number(record.harvestedQuantity));
  }

  if (loading) return <Loading />;

  return <>
    <div className="page-heading"><div><h1>Cosecha y producción</h1><p>Registra cada corte con su ubicación, ciclo, rendimiento, calidad y merma.</p></div><div className="heading-buttons"><button className="button" onClick={openNew} disabled={!data.fields.length || busy}><Plus size={17} />Registrar cosecha</button></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}

    <div className="mini-stat-grid production-stat-grid">
      <Panel><div><small>Registros de cosecha</small><strong>{filtered.length}</strong></div></Panel>
      <Panel><div><small>Estimado</small><strong>{number(total(record => Number(record.estimatedYield ?? 0)))}</strong><em>{summaryUnit ? unitLabel : 'Sin registros'}</em></div></Panel>
      <Panel><div><small>Cosechado</small><strong>{number(total(record => Number(record.harvestedQuantity ?? 0)))}</strong><em>{summaryUnit ? unitLabel : 'Sin registros'}</em></div></Panel>
      <Panel><div><small>Rechazado</small><strong>{number(total(record => Number(record.rejectedQuantity ?? 0)))}</strong><em>{summaryUnit ? unitLabel : 'Sin registros'}</em></div></Panel>
    </div>
    <div className="record-overview-grid">
      <Panel title="Mapa de producción de la finca" className="record-overview-map" action={blockFilter ? <button className="text-button" onClick={() => setBlockFilter(0)}>Todos los bloques</button> : null}>
        <FarmMap farm={data.farms[0]} fields={data.fields} blocks={data.blocks} demo={mode === 'demo'} selected={blockFilter} onSelect={id => setBlockFilter(current => current === id ? 0 : id)}
          blockPresentation={new Map(data.blocks.map(block => [block.id, {
            color: byBlock.has(block.id) ? '#2f985b' : '#8b9992',
            detail: byBlock.has(block.id) ? `${number(byBlock.get(block.id) ?? 0)} ${summaryUnit}` : 'Sin registro',
          }]))} />
      </Panel>
      <div className="record-side-panels">
        <Panel title="Próximas cosechas" action={<button className="text-button" onClick={() => navigate('tasks')}>Ver tareas<ArrowRight size={14} /></button>}>
          {activities.length ? <ul className="record-summary-list">{activities.map(task => <li key={task.id}><strong>{task.title}</strong><span>{new Date(`${task.date}T12:00:00`).toLocaleDateString('es-CO')} · {data.blocks.find(block => block.id === task.blockId)?.code ?? task.assignee}</span></li>)}</ul> : <p className="muted">Sin cosechas programadas para esta fecha.</p>}
        </Panel>
        <Panel title="Calidad de la producción">
          {filtered.length ? <div className="record-ring-summary">
            <Donut value={number(filtered.length)} label="Cosechas" segments={quality.map(grade => grade.count)} colors={qualityColors} />
            <ul className="record-summary-list">{quality.map((grade, index) => grade.count ? <li key={grade.value}><i style={{ backgroundColor: qualityColors[index] }} /><span>{grade.label}</span><strong>{grade.count}</strong></li> : null)}</ul>
          </div> : <p className="muted">Sin cosechas para la selección actual.</p>}
        </Panel>
      </div>
    </div>
    <div className="record-filters"><label>Ciclo<select value={cycleFilter} onChange={event => setCycleFilter(event.target.value)}><option value="all">Todos los ciclos</option>{cycles.map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.code} · {cycle.crop}</option>)}</select></label><label>Unidad<select value={unitFilter} onChange={event => setUnitFilter(event.target.value)}><option value="all">Todas las unidades</option>{productionUnits.map(unit => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></label>{(cycleFilter !== 'all' || unitFilter !== 'all') && <button className="text-button" onClick={() => { setCycleFilter('all'); setUnitFilter('all'); }}>Limpiar</button>}</div>
    <Panel title="Historial estructurado de cosechas">
      {filtered.length ? <div className="table-wrap">
        <table className="responsive-record-table">
          <thead><tr>{['Ubicación', 'Fecha', 'Ciclo', 'Área', 'Estimado', 'Cosechado', 'Rechazado', 'Calidad', 'Variación', 'Acciones'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>
            {filtered.map(record => {
              const cycle = record.cropCycleId ? cycleById.get(record.cropCycleId) : undefined;
              const actual = Number(record.harvestedQuantity ?? 0) + Number(record.rejectedQuantity ?? 0);
              const variance = record.estimatedYield == null ? null : actual - record.estimatedYield;
              return <tr key={record.id}>
                <td data-label="Ubicación"><strong>{locationLabel(record)}</strong><small className="table-subtitle">{record.crop ?? 'Cultivo sin especificar'}{record.variety ? ` · ${record.variety}` : ''}</small></td>
                <td data-label="Fecha">{new Date(record.actualHarvestDate ? `${record.actualHarvestDate}T12:00:00` : record.recordedAt).toLocaleDateString('es-CO')}</td>
                <td data-label="Ciclo">{cycle?.code ?? 'Sin ciclo'}</td>
                <td data-label="Área">{record.harvestedAreaHa != null ? `${number(record.harvestedAreaHa, 2)} ha` : '—'}</td>
                <td data-label="Estimado">{record.estimatedYield != null ? `${number(record.estimatedYield)} ${record.yieldUnit}` : '—'}</td>
                <td data-label="Cosechado">{number(record.harvestedQuantity)} {record.yieldUnit}</td>
                <td data-label="Rechazado">{number(record.rejectedQuantity ?? 0)} {record.yieldUnit}{record.rejectedReason && <small className="table-subtitle">{record.rejectedReason}</small>}</td>
                <td data-label="Calidad"><Badge tone={record.qualityGrade === 'REJECTED' ? 'red' : record.qualityGrade === 'PREMIUM' ? 'green' : 'neutral'}>{record.qualityGrade}</Badge></td>
                <td data-label="Variación">{variance == null ? '—' : `${variance >= 0 ? '+' : ''}${number(variance)} ${record.yieldUnit}`}</td>
                <td data-label="Acciones"><div className="production-actions">
                  <button className="text-button" aria-label={`Ver cosecha ${record.id}`} onClick={() => openView(record)}><Eye size={15} />Ver</button>
                  <button className="text-button" aria-label={`Editar cosecha ${record.id}`} onClick={() => openEdit(record)}><Pencil size={15} />Editar</button>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div> : <Empty title="Sin cosechas para esta selección" description="Registra una cosecha o ajusta los filtros." />}
      <div className="table-pagination"><span>{filtered.length} registros</span><span>Variación respecto al estimado, con la cantidad rechazada incluida.</span></div>
    </Panel>
    {selected && <HarvestDetail record={selected} cycle={selected.cropCycleId ? cycleById.get(selected.cropCycleId) : undefined} location={locationLabel(selected)} onClose={() => setSelected(null)} onEdit={() => openEdit(selected)} />}
    {form && <HarvestForm record={form === 'new' ? undefined : form} data={data} cycles={cycles} busy={busy} onClose={() => !busy && setForm(null)} onSave={saveRecord} />}
  </>;
}

function HarvestDetail({ record, cycle, location, onClose, onEdit }: { record: ProductionRecord; cycle?: Cycle; location: string; onClose: () => void; onEdit: () => void }) {
  const unitLabel = productionUnits.find(unit => unit.value === record.yieldUnit)?.label ?? record.yieldUnit;
  const qualityLabel = qualityGrades.find(grade => grade.value === record.qualityGrade)?.label ?? record.qualityGrade;
  const cycleLabel = cycle?.code ?? (record.cropCycleId ? `Ciclo #${record.cropCycleId}` : 'Sin ciclo');
  return <Modal title="Detalle de cosecha" onClose={onClose} wide>
    <div className="production-detail">
      <div className="activity-detail-intro"><span className="stat-icon gold"><Wheat size={25} /></span><div>
        <h3>{record.crop ?? 'Cosecha registrada'}{record.variety ? ` · ${record.variety}` : ''}</h3><p>{location}</p>
      </div></div>
      <section className="activity-detail-section">
        <div className="panel-heading"><h3>Ubicación y fechas</h3></div>
        <dl className="detail-list">
          <div><dt>Ciclo de cultivo</dt><dd>{cycleLabel}</dd></div>
          <div><dt>Área cosechada</dt><dd>{record.harvestedAreaHa == null ? 'Sin dato' : `${number(record.harvestedAreaHa, 2)} ha`}</dd></div>
          <div><dt>Fecha de cosecha</dt><dd>{record.actualHarvestDate ? new Date(`${record.actualHarvestDate}T12:00:00`).toLocaleDateString('es-CO') : 'Sin fecha'}</dd></div>
          <div><dt>Fecha y hora del registro</dt><dd>{new Date(record.recordedAt).toLocaleString('es-CO')}</dd></div>
        </dl>
      </section>
      <section className="activity-detail-section">
        <div className="panel-heading"><h3>Producción y calidad</h3></div>
        <dl className="detail-list">
          <div><dt>Cantidad cosechada</dt><dd>{number(record.harvestedQuantity)} {unitLabel}</dd></div>
          <div><dt>Rendimiento estimado</dt><dd>{record.estimatedYield == null ? 'Sin dato' : `${number(record.estimatedYield)} ${record.yieldUnit}`}</dd></div>
          <div><dt>Calidad o grado</dt><dd>{qualityLabel}</dd></div>
          <div><dt>Cantidad rechazada</dt><dd>{number(record.rejectedQuantity ?? 0)} {unitLabel}</dd></div>
          {record.rejectedReason && <div><dt>Motivo del rechazo</dt><dd>{record.rejectedReason}</dd></div>}
        </dl>
      </section>
      <section className="activity-detail-section"><div className="panel-heading"><h3>Notas de cosecha</h3></div><p className="activity-detail-note">{record.notes || 'No se registraron notas.'}</p></section>
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onClose}>Cerrar</button>
        <button type="button" className="button" onClick={onEdit}><Pencil size={15} />Editar cosecha</button>
      </div>
    </div>
  </Modal>;
}

function dateTimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function HarvestForm({ record, data, cycles, busy, onClose, onSave }: { record?: ProductionRecord; data: ReturnType<typeof useApp>['data']; cycles: Cycle[]; busy: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>, recordId?: number) => Promise<void> }) {
  const initialRow = record?.rowId ? data.rows.find(row => row.id === record.rowId) : undefined;
  const initialBlock = record?.blockId ? data.blocks.find(block => block.id === record.blockId) : initialRow?.block;
  const initialFieldId = record?.fieldId ?? initialBlock?.field.id ?? initialRow?.block.field.id ?? data.fields[0]?.id ?? 0;
  const [locationType, setLocationType] = useState<HarvestLocation>(record?.rowId ? 'row' : record?.blockId ? 'block' : 'field');
  const [fieldId, setFieldId] = useState(initialFieldId);
  const [blockId, setBlockId] = useState(record?.blockId ?? initialRow?.block.id ?? 0);
  const [rowId, setRowId] = useState(record?.rowId ?? 0);
  const [cycleId, setCycleId] = useState(record?.cropCycleId ?? 0);
  const [error, setError] = useState('');
  const firstFieldId = data.fields[0]?.id ?? 0;
  const fields = data.fields;
  const blocks = data.blocks.filter(block => block.field.id === fieldId);
  const rows = data.rows.filter(row => row.block.field.id === fieldId && (!blockId || row.block.id === blockId));
  const selectedBlock = data.blocks.find(block => block.id === blockId);
  const selectedRow = data.rows.find(row => row.id === rowId);
  const selectedCycle = cycles.find(cycle => cycle.id === cycleId);
  const availableCycles = cycles.filter(cycle => {
    if (locationType === 'field') return cycle.blockId && data.blocks.some(block => block.id === cycle.blockId && block.field.id === fieldId);
    if (locationType === 'row') return cycle.blockId === (selectedRow?.block.id ?? blockId);
    return cycle.blockId === blockId;
  });
  const defaultArea = locationType === 'field' ? fields.find(field => field.id === fieldId)?.areaHa : selectedBlock?.areaHa;

  useEffect(() => { if (!fieldId && firstFieldId) setFieldId(firstFieldId); }, [fieldId, firstFieldId]);
  useEffect(() => { if (locationType === 'block' && !blockId && blocks[0]) setBlockId(blocks[0].id); }, [blockId, blocks, locationType]);
  useEffect(() => { if (locationType === 'row' && !rowId && rows[0]) setRowId(rows[0].id); }, [locationType, rowId, rows]);
  useEffect(() => { if (!availableCycles.some(cycle => cycle.id === cycleId)) setCycleId(availableCycles[0]?.id ?? 0); }, [availableCycles, cycleId]);

  function changeLocationType(value: HarvestLocation) {
    setLocationType(value); setCycleId(0); setRowId(0); if (value === 'field') setBlockId(0); else if (!blockId && blocks[0]) setBlockId(blocks[0].id);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rejectedQuantity = Number(form.get('rejectedQuantity') || 0);
    const rejectedReason = String(form.get('rejectedReason') || '').trim();
    if (!cycleId) { setError('Selecciona el ciclo de cultivo para conservar el historial productivo.'); return; }
    if (rejectedQuantity > 0 && !rejectedReason) { setError('Indica el motivo de la cantidad rechazada.'); return; }
    const recordedAt = new Date(String(form.get('recordedAt')));
    if (Number.isNaN(recordedAt.getTime())) { setError('Indica una fecha y hora válida.'); return; }
    const locationBlockId = locationType === 'field' ? undefined : locationType === 'row' ? selectedRow?.block.id : blockId;
    const payload: Record<string, unknown> = {
      recordType: 'HARVEST', fieldId, blockId: locationBlockId, rowId: locationType === 'row' ? rowId : undefined,
      cropCycleId: cycleId, recordedAt: recordedAt.toISOString(), actualHarvestDate: String(form.get('actualHarvestDate')),
      expectedHarvestDate: selectedCycle?.expectedHarvestOn || undefined, crop: selectedCycle?.crop, variety: selectedCycle?.variety,
      growthStage: 'HARVEST', harvestedAreaHa: Number(form.get('harvestedAreaHa')), estimatedYield: Number(form.get('estimatedYield')),
      harvestedQuantity: Number(form.get('harvestedQuantity')), yieldUnit: String(form.get('yieldUnit')), qualityGrade: String(form.get('qualityGrade')),
      rejectedQuantity, rejectedReason: rejectedReason || undefined, notes: String(form.get('notes') || '').trim() || undefined,
    };
    setError(''); await onSave(payload, record?.id);
  }

  const now = new Date();
  const defaultDateTime = `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return <Modal title={record ? 'Editar cosecha' : 'Registrar cosecha'} onClose={onClose} wide>
    <form className="form-stack" onSubmit={submit}>
      <fieldset className="record-form-section form-grid">
        <legend>Ubicación y ciclo</legend>
        <label>Registrar en<select value={locationType} onChange={event => changeLocationType(event.target.value as HarvestLocation)}><option value="field">Campo</option><option value="block">Bloque</option><option value="row">Fila</option></select></label>
        <label>Campo<select value={fieldId} onChange={event => { setFieldId(Number(event.target.value)); setBlockId(0); setRowId(0); setCycleId(0); }} required>
          {fields.map(field => <option key={field.id} value={field.id}>{field.name} · {field.areaHa ?? '—'} ha</option>)}
        </select></label>
        {locationType !== 'field' && <label>Bloque<select value={blockId} onChange={event => { setBlockId(Number(event.target.value)); setRowId(0); setCycleId(0); }} required>
          <option value="">Seleccionar bloque</option>{blocks.map(block => <option key={block.id} value={block.id}>{block.code} · {block.areaHa ?? '—'} ha</option>)}
        </select></label>}
        {locationType === 'row' && <label>Fila<select value={rowId} onChange={event => { setRowId(Number(event.target.value)); setCycleId(0); }} required>
          <option value="">Seleccionar fila</option>{rows.map(row => <option key={row.id} value={row.id}>{row.rowCode}</option>)}
        </select></label>}
        <label className="full-span">Ciclo de cultivo<select value={cycleId} onChange={event => setCycleId(Number(event.target.value))} required>
          <option value="">Seleccionar ciclo</option>{availableCycles.map(cycle => <option key={cycle.id} value={cycle.id}>{cycle.code} · {cycle.crop}{cycle.variety ? ` · ${cycle.variety}` : ''}</option>)}
        </select>{!availableCycles.length && <small>Crea un ciclo en Siembra y ciclos para registrar la cosecha en esta ubicación.</small>}</label>
        <label>Fecha de cosecha<input name="actualHarvestDate" type="date" max={localDate()} defaultValue={record?.actualHarvestDate ?? localDate()} required /></label>
        <label>Fecha y hora del registro<input name="recordedAt" type="datetime-local" defaultValue={record ? dateTimeLocalValue(record.recordedAt) : defaultDateTime} required /></label>
      </fieldset>
      <fieldset className="record-form-section form-grid">
        <legend>Producción y calidad</legend>
        <label>Área cosechada (ha)<input name="harvestedAreaHa" type="number" min="0.001" step="0.001" defaultValue={record?.harvestedAreaHa ?? defaultArea ?? ''} required /></label>
        <label>Unidad<select name="yieldUnit" defaultValue={record?.yieldUnit ?? 'kg'} required>{productionUnits.map(unit => <option key={unit.value} value={unit.value}>{unit.label}</option>)}</select></label>
        <label>Rendimiento estimado<input name="estimatedYield" type="number" min="0" step="0.001" defaultValue={record?.estimatedYield ?? ''} required /></label>
        <label>Cantidad cosechada<input name="harvestedQuantity" type="number" min="0" step="0.001" defaultValue={record?.harvestedQuantity ?? ''} required /></label>
        <label>Calidad o grado<select name="qualityGrade" defaultValue={record?.qualityGrade ?? 'A'} required>{qualityGrades.map(grade => <option key={grade.value} value={grade.value}>{grade.label}</option>)}</select></label>
        <label>Cantidad rechazada o dañada<input name="rejectedQuantity" type="number" min="0" step="0.001" defaultValue={record?.rejectedQuantity ?? 0} /></label>
        <label className="full-span">Motivo del rechazo<input name="rejectedReason" maxLength={1000} placeholder="Obligatorio si hay rechazo" defaultValue={record?.rejectedReason ?? ''} /></label>
        <label className="full-span">Notas de cosecha<textarea name="notes" maxLength={4000} placeholder="Novedades, condiciones del corte o instrucciones de calidad." defaultValue={record?.notes ?? ''} /></label>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="button" disabled={busy || !availableCycles.length}>{busy ? 'Guardando…' : record ? 'Guardar cambios' : 'Guardar cosecha'}</button>
      </div>
    </form>
  </Modal>;
}

const agronomicGuides = [
  { icon: Bug, title: 'Revisar alertas de sanidad', description: 'Consulta las observaciones y las medidas registradas para cada bloque.', target: 'disease', label: 'Ver observaciones', color: 'orange' },
  { icon: Droplets, title: 'Consultar el historial de riego', description: 'Revisa la humedad registrada, los sectores activos y la ejecución del riego.', target: 'irrigation', label: 'Ver registros de riego', color: 'blue' },
  { icon: Sprout, title: 'Revisar aplicaciones de fertilización', description: 'Consulta la trazabilidad de los análisis de suelo, planes y aplicaciones por zona.', target: 'fertilization', label: 'Ver fertilización', color: 'green' },
  { icon: Wheat, title: 'Acompañar el cierre del ciclo', description: 'Consulta los registros de cosecha, rendimiento, calidad y merma.', target: 'harvest', label: 'Ver cosechas', color: 'gold' },
] as const;

function AgronomicCenter() {
  const { data, farmId, mode, navigate, search } = useApp();
  const [layer, setLayer] = useState<'health' | 'moisture' | 'nutrients'>('health');
  const [selected, setSelected] = useState(0);
  const [analysis, setAnalysis] = useState<AnalyticsLayer>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => { setSelected(0); }, [farmId, mode]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setAnalysis(undefined);
    const load = async () => {
      try {
        const result = mode === 'demo' ? withIrrigation(
          withSoilAnalyses(withInspectionHealth(demoAnalytics, readDemo(inspectionDemoKey, demoInspections())), readFertilizationDemo().analyses),
          readIrrigationDemo().sectors,
        ) : await api.analyticsMap(farmId);
        if (active) setAnalysis(result);
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'No se pudo cargar el análisis de la finca.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [farmId, mode, version]);
  const blocks = (analysis?.features ?? []).map(feature => feature.properties)
    .filter(block => data.blocks.some(item => item.id === block.blockId) && (!selected || block.blockId === selected));
  const dry = blocks.filter(block => block.conditionStatus === 'BELOW_RANGE' || block.irrigationSectors?.some(sector => sector.condition === 'BELOW_RANGE'));
  const findings = blocks.filter(block => block.healthStatus === 'ACTIVE_FINDINGS');
  const soil = blocks.filter(block => block.soilAnalysis?.results.length);
  const healthPresentation = mode === 'demo' && layer === 'health' && analysis
    ? new Map(analysis.features.map(({ properties: block }) => {
      const status = block.healthStatus ?? 'NO_RECENT_INSPECTION';
      return [block.blockId, {
        color: status === 'ACTIVE_FINDINGS' ? '#dc6243' : status === 'NO_ACTIVE_FINDINGS' ? '#238d55' : '#879a93',
        detail: healthLabels[status],
      }];
    })) : undefined;
  const guides = agronomicGuides.filter(guide => `${guide.title} ${guide.description} ${guide.label}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  return <>
    <div className="page-heading"><div><h1>Centro agronómico</h1><p>Revisa las condiciones por bloque y prioriza el seguimiento con los datos registrados en tu finca.</p></div>
      <button className="button" onClick={() => setVersion(value => value + 1)} disabled={loading}><Sparkles size={17} />Actualizar análisis</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="mini-stat-grid">
      <Panel><span className="icon-tile green"><MapPin size={22} /></span><div><small>Bloques analizados</small><strong>{analysis ? blocks.length : '—'}</strong></div></Panel>
      <Panel><span className="icon-tile orange"><Bug size={22} /></span><div><small>Hallazgos sanitarios activos</small><strong>{analysis ? findings.length : '—'}</strong></div></Panel>
      <Panel><span className="icon-tile blue"><Droplets size={22} /></span><div><small>Humedad por debajo del rango</small><strong>{analysis ? dry.length : '—'}</strong></div></Panel>
      <Panel><span className="icon-tile green"><FlaskConical size={22} /></span><div><small>Bloques con datos de suelo</small><strong>{analysis ? soil.length : '—'}</strong></div></Panel>
    </div>
    <div className="record-overview-grid">
      <Panel title="Análisis integral de la finca" className="record-overview-map" action={selected ? <button className="text-button" onClick={() => setSelected(0)}>Todos los bloques</button> : null}>
        <div className="toolbar"><div className="tabs scroll-tabs">{(['health', 'moisture', 'nutrients'] as const).map((key, index) => <button key={key} className={layer === key ? 'active' : ''} onClick={() => setLayer(key)} aria-pressed={layer === key}>{['Salud del cultivo', 'Humedad', 'Nutrientes'][index]}</button>)}</div></div>
        <FarmMap blocks={data.blocks} fields={data.fields} farm={data.farms[0]} demo={mode === 'demo'} analytics={analysis} layer={healthPresentation ? 'satellite' : layer}
          blockPresentation={healthPresentation} selected={selected} onSelect={id => setSelected(current => current === id ? 0 : id)} />
      </Panel>
      <Panel title="Seguimiento prioritario">
        {loading ? <Loading /> : <>
          {findings.length > 0 && <div className="activity-detail-section"><strong>Hallazgos sanitarios activos</strong><p>{findings.map(block => block.blockCode).join(', ')}</p><button className="text-button" onClick={() => navigate('disease')}>Consultar observaciones<ArrowRight size={14} /></button></div>}
          {dry.length > 0 && <div className="activity-detail-section"><strong>Humedad por debajo del rango</strong><p>{dry.map(block => block.blockCode).join(', ')}</p><button className="text-button" onClick={() => navigate('irrigation')}>Revisar humedad y riego<ArrowRight size={14} /></button></div>}
          {!error && !findings.length && !dry.length && <p className="muted">Sin hallazgos activos ni lecturas por debajo del rango en la selección.</p>}
        </>}
      </Panel>
    </div>
    <div className="insights-grid">{guides.map(guide => <Panel key={guide.title}>
      <span className={`stat-icon ${guide.color}`}><guide.icon size={24} /></span>
      <h3 className="insight-title">{guide.title}</h3><p className="insight-description">{guide.description}</p>
      <button className="text-button" onClick={() => navigate(guide.target)}>{guide.label}<ArrowUpRight size={15} /></button>
    </Panel>)}</div>
    {!guides.length && <Panel><Empty title="Sin guías para esta búsqueda" description="Prueba con riego, fertilización, sanidad o cosecha." /></Panel>}
  </>;
}

function ReportOverview() {
  const { data, date } = useApp();
  const monthFormatter = new Intl.DateTimeFormat('es-CO', { month: 'short' });
  const [year, month] = date.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(year, month - 6 + index, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const events = data.events.filter(event => new Date(event.occurredAt) >= start && new Date(event.occurredAt) < end);
    return { label: monthFormatter.format(start), events, key: localDate(start) };
  });
  const current = months[months.length - 1].events;
  const types = [
    { type: 'HARVEST_EVENT', title: 'Registros de cosecha', icon: Wheat, color: 'gold' },
    { type: 'IRRIGATION_EVENT', title: 'Registros de riego', icon: Droplets, color: 'blue' },
    { type: 'FERTILIZER_APPLICATION', title: 'Aplicaciones registradas', icon: FlaskConical, color: 'green' },
    { type: 'SCOUTING_OBSERVATION', title: 'Observaciones sanitarias', icon: Bug, color: 'orange' },
  ];
  const peak = Math.max(1, ...months.map(item => item.events.length));
  return <>
    <div className="mini-stat-grid">{types.map(item => <Panel key={item.type}><span className={`icon-tile ${item.color}`}><item.icon size={22} /></span><div>
      <small>{item.title}</small><strong>{current.filter(event => event.eventType === item.type).length}</strong><em>{monthFormatter.format(new Date(year, month - 1, 1))} {year}</em>
    </div></Panel>)}</div>
    <Panel title="Evolución de actividad" className="report-trends">
      <p className="section-caption">Eventos de campo registrados durante los últimos seis meses de la fecha seleccionada.</p>
      <ol className="report-bars">{months.map(item => <li key={item.key}><strong>{item.events.length}</strong><div className="report-bar-track"><span style={{ height: `${item.events.length / peak * 100}%` }} /></div><span>{item.label}</span></li>)}</ol>
    </Panel>
  </>;
}

function OperationsHistory({ page }: { page: Page }) {
  const { data, mode, role, search, tasks, navigate, notify } = useApp();
  const [form, setForm] = useState(false);
  const [selected, setSelected] = useState<FieldEvent | null>(null);
  const [type, setType] = useState('all');
  const [block, setBlock] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState('history');
  const module = modules[page as keyof typeof modules];
  const filtered = data.events.filter(event => (!module || (page === 'disease' ? ['SCOUTING_OBSERVATION', 'TREATMENT_APPLICATION'].includes(event.eventType) : event.eventType === module.type)) &&
    (type === 'all' || event.eventType === type) && (block === 'all' || (event.block?.id ?? event.row?.block.id) === Number(block)) &&
    (!from || event.occurredAt >= new Date(`${from}T00:00:00`).toISOString()) && (!to || event.occurredAt <= new Date(`${to}T23:59:59.999`).toISOString()) &&
    `${eventLabels[event.eventType]} ${event.notes ?? ''} ${event.block?.code ?? event.row?.block.code ?? ''}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt));

  function exportCsv() {
    const records = [['Actividad', 'Fecha', 'Bloque', 'Surco', 'Autor ID', 'Notas'], ...filtered.map(event => [eventLabels[event.eventType], new Date(event.occurredAt).toLocaleString('es-CO'), event.block?.code ?? event.row?.block.code, event.row?.rowCode, event.createdByUserId, event.notes])];
    const content = '\uFEFF' + records.map(record => record.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `agrovision-${mode === 'demo' ? 'demo-' : ''}${page}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exportados ${filtered.length} registros${mode === 'demo' ? ' de demostración' : ''}.`);
  }

  return <>
    <div className="page-heading"><div><span className="eyebrow">{module?.eyebrow ?? 'ACTIVIDAD DE CAMPO'}</span><h1>{module?.title ?? 'Reportes y analítica'}</h1><p>{module?.subtitle ?? 'Consulta el consumo de agua, compara la ejecución con lo planificado y exporta el historial de labores.'}</p></div><div className="heading-buttons"><button className="button secondary" onClick={exportCsv} disabled={!filtered.length}><Download size={16} />Exportar CSV</button><button className="button" disabled={!data.blocks.length} onClick={() => setForm(true)}><Plus size={17} />{page === 'disease' ? 'Nueva observación' : 'Registrar actividad'}</button></div></div>
    {module && <div className={`operation-banner operation-${page}`}><span className={`stat-icon ${module.color}`}><module.icon size={31} /></span><div><span>HISTORIAL DE {module.title.toLocaleUpperCase('es')}</span><strong>{filtered.length} {filtered.length === 1 ? 'actividad registrada' : 'actividades registradas'}</strong><p>Conoce lo que se ha hecho y conserva cada detalle.</p></div><button className="button secondary small" onClick={() => navigate('maps')}>Explorar mapas<ArrowUpRight size={15} /></button></div>}
    {page === 'reports' && <><ReportOverview /><WaterUsageAnalyticsPanel /></>}
    <div className="toolbar"><div className="tabs"><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><ClipboardList size={16} />Historial<span>{filtered.length}</span></button>{module && <button className={tab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')}><CalendarDays size={16} />Trabajo programado{mode === 'demo' && <Badge tone="neutral">Demo</Badge>}</button>}</div></div>
    {tab === 'plans' && module ? mode === 'demo' ? <><Notice>Planificación de demostración local. Los planes agronómicos y las tareas aún no están disponibles en el backend.</Notice><div className="planned-work">{tasks.filter(task => task.activity === module.activity && data.blocks.some(item => item.id === task.blockId)).map(task => <Panel key={task.id}><div className="planned-work-top"><span className={`icon-tile ${module.color}`}><module.icon size={22} /></span><Badge tone={task.status === 'blocked' ? 'red' : 'neutral'}>{statusLabels[task.status]}</Badge></div><h3>{task.title}</h3><p>{task.assignee} · {data.blocks.find(item => item.id === task.blockId)?.code}</p><span className="detail-date"><CalendarDays size={14} />{task.date} · {task.time}</span><button className="text-button" onClick={() => navigate('tasks')}>Abrir trabajo del día<ArrowRight size={15} /></button></Panel>)}</div></> : <Panel><Empty title="El siguiente paso: planificar" description="Los planes y las tareas por trabajador se integrarán en la siguiente etapa. Mientras tanto, puedes registrar lo que ya se realizó." /></Panel> : <>
    <div className="record-filters">{!module && <label>Actividad<select value={type} onChange={event => setType(event.target.value)}><option value="all">Todas las actividades</option>{Object.entries(eventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<label>Bloque<select value={block} onChange={event => setBlock(event.target.value)}><option value="all">Todos los bloques</option>{data.blocks.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label><label>Desde<input type="date" value={from} onChange={event => setFrom(event.target.value)} max={to || undefined} /></label><label>Hasta<input type="date" value={to} onChange={event => setTo(event.target.value)} min={from || undefined} /></label>{(type !== 'all' || block !== 'all' || from || to) && <button className="text-button" onClick={() => { setType('all'); setBlock('all'); setFrom(''); setTo(''); }}>Limpiar</button>}</div>
    <Panel><div className="table-wrap"><table><thead><tr><th>Actividad</th><th>Ubicación</th><th>Fecha y hora</th><th>Notas</th><th>Detalle</th></tr></thead><tbody>{filtered.map(event => <tr key={event.id}><td><span className="table-title"><EventIcon event={event} />{eventLabels[event.eventType]}</span></td><td>{event.block?.code ?? event.row?.block.code ?? 'Sin bloque'}<small className="table-subtitle">{event.row?.rowCode ?? 'Todo el bloque'}</small></td><td className="nowrap">{new Date(event.occurredAt).toLocaleDateString('es-CO')}<small className="table-subtitle">{new Date(event.occurredAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</small></td><td className="notes-cell">{event.notes || 'Sin notas'}</td><td><button className="icon-button" aria-label={`Ver actividad ${event.id}`} onClick={() => setSelected(event)}><Eye size={18} /></button></td></tr>)}</tbody></table>{!filtered.length && <Empty title="Cada registro es una semilla" description="No hay actividades con estos filtros. Registra la primera o cambia la búsqueda." />}</div><div className="table-pagination"><span>{filtered.length} registros{mode === 'demo' ? ' de demostración' : ''}</span><span>Fechas en la zona horaria de tu dispositivo</span></div></Panel>
    {module && <p className="page-note">{page === 'fertilization' ? 'El registro actual almacena la actividad y sus notas. Productos, dosis y planes estructurados están pendientes.' : page === 'irrigation' ? 'Los sensores y las mediciones automáticas de humedad no están conectados. Este historial contiene eventos registrados por el equipo.' : page === 'disease' ? 'Las observaciones requieren revisión profesional y no constituyen diagnósticos confirmados. Los detalles de síntomas se guardan al crear el evento; el API aún no los devuelve para su consulta.' : 'El registro actual conserva la jornada y sus notas. Rendimiento, calidad y cantidades estructuradas están pendientes.'}</p>}
    </>}
    {form && <EventForm key={page} initialType={module?.type} onClose={() => setForm(false)} />}
    {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
  </>;
}

function EventDetail({ event, onClose }: { event: FieldEvent; onClose: () => void }) {
  const { mode, role, remove, notify } = useApp();
  const [media, setMedia] = useState<{ id: number; kind: string; s3Key: string; contentType?: string }[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (mode === 'demo') { setMedia(readDemo(`media.${event.id}`, [])); return; }
    let active = true;
    api.media(event.id).then(result => { if (active) setMedia(result); }).catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [event.id, mode]);

  async function registerMedia(submit: FormEvent<HTMLFormElement>) {
    submit.preventDefault(); const form = new FormData(submit.currentTarget); setError(''); setBusy(true);
    const payload = { eventId: event.id, kind: String(form.get('kind')), s3Key: String(form.get('s3Key')).trim(), contentType: String(form.get('contentType')).trim() };
    try {
      if (mode === 'demo') { const next = [...media, { id: Date.now(), ...payload }]; if (!saveDemo(`media.${event.id}`, next)) throw new Error('No se pudo guardar en el navegador.'); setMedia(next); }
      else { await api.create('media', payload); setMedia(await api.media(event.id)); }
      setAdding(false); notify('Referencia de archivo registrada.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); } finally { setBusy(false); }
  }

  async function deleteEvent() {
    setBusy(true);
    try { await remove('events', event.id); notify('Actividad eliminada.'); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo eliminar.'); } finally { setBusy(false); }
  }

  const block = event.block ?? event.row?.block;
  const date = new Date(event.occurredAt);

  return <Modal title="Detalle de actividad" onClose={() => !busy && onClose()} wide>
    <div className="event-detail">
      <div className="activity-detail-intro">
        <EventIcon event={event} />
        <div>
          <h3>{eventLabels[event.eventType]}</h3>
          <p>{date.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
      </div>
      <dl className="detail-list">
        <div><dt>Campo</dt><dd>{block?.field.name ?? 'Sin campo asociado'}</dd></div>
        <div><dt>Bloque</dt><dd>{block?.code ?? 'Sin bloque asociado'}</dd></div>
        <div><dt>Surco</dt><dd>{event.row?.rowCode ?? 'Todo el bloque'}</dd></div>
        <div><dt>Autor</dt><dd>Usuario #{event.createdByUserId}</dd></div>
        {event.plantIndexStart != null && <div><dt>Rango de plantas</dt><dd>{event.plantIndexStart}–{event.plantIndexEnd}</dd></div>}
      </dl>
      <section className="activity-detail-section">
        <div className="panel-heading"><h3>Notas de la actividad</h3></div>
        <p className="activity-detail-note">{event.notes || 'No se registraron notas.'}</p>
      </section>
      <div className="activity-detail-section">
        <PhotoGallery target={{ eventId: event.id }} onBusyChange={setBusy} />
      </div>
      <section className="activity-detail-section">
        <div className="panel-heading">
          <h3>Referencias de archivos</h3>
          <button className="text-button" aria-expanded={adding} onClick={() => setAdding(value => !value)}>{adding ? 'Ocultar formulario' : 'Registrar referencia'}</button>
        </div>
        {media.map(item => <div className="media-record" key={item.id}>
          <FileText size={19} /><div><strong>{item.s3Key}</strong><small>{item.kind} · {item.contentType || 'Sin tipo'}</small></div>
        </div>)}
        {!media.length && !adding && <p className="muted">Sin referencias de archivos.</p>}
        {adding && <form onSubmit={registerMedia} className="form-grid inline-form">
          <label>Tipo<select name="kind"><option value="IMAGE">Imagen</option><option value="DOCUMENT">Documento</option><option value="VIDEO">Video</option></select></label>
          <label>Tipo de contenido<input name="contentType" placeholder="image/jpeg" /></label>
          <label className="full-span">Clave del objeto S3<input name="s3Key" required placeholder="eventos/archivo.jpg" /></label>
          <div className="form-actions full-span"><button disabled={busy} className="button"><Check size={15} />Guardar referencia</button></div>
        </form>}
      </section>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions">
        {role !== 'WORKER' && (confirm ? <>
          <p>¿Eliminar esta actividad y sus referencias asociadas? Esta acción es permanente.</p>
          <button className="button secondary" onClick={() => setConfirm(false)} disabled={busy}>Cancelar</button>
          <button className="button danger" disabled={busy} onClick={() => void deleteEvent()}>Confirmar eliminación</button>
        </> : <button className="text-button text-red" onClick={() => setConfirm(true)} disabled={busy}><Trash2 size={14} />Eliminar actividad</button>)}
        {!confirm && <button className="button secondary" onClick={onClose} disabled={busy}>Volver al historial</button>}
      </div>
    </div>
  </Modal>;
}
