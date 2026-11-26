import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Bug, CalendarDays, ClipboardList, Download, Eye, MapPin, Plus } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { localDate, number } from '../lib/domain';
import { readDemo, saveDemo } from '../lib/demo';
import { assessmentLabels, demoInspections, incidence, inspectionCsv, inspectionDemoKey, loadSanitaryProblemsDemo } from '../lib/inspections';
import type { Inspection, NewInspection, SanitaryProblem, AssessmentStatus } from '../lib/inspections';
import { addDemoMonitoringAlert, followingMonitoringWindow, monitoringDate } from '../lib/inspection-monitoring';
import type { DemoMonitoredInspection, MonitoringAlert, MonitoringPlan } from '../lib/inspection-monitoring';
import { Badge, Empty, Loading, Modal, Notice, Panel } from '../components/ui';
import InspectionActions from '../components/InspectionActions';
import InspectionMonitoring from '../components/InspectionMonitoring';
import InspectionOverview from '../components/InspectionOverview';
import '../inspections.css';

function visitDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function InspectionStatus({ record }: { record: Inspection }) {
  if (record.canceledAt) return <Badge tone="neutral">Anulada</Badge>;
  const tone = record.assessmentStatus === 'DISCARDED' ? 'neutral' : record.assessmentStatus === 'CONFIRMED' ? 'red' : 'gold';
  return <span className="inspection-status"><Badge tone={tone}>{assessmentLabels[record.assessmentStatus]}</Badge>{record.resolved && <Badge tone="green">Resuelta</Badge>}</span>;
}

export default function Inspections({ navigation, monitoring = false }: { navigation: ReactNode; monitoring?: boolean }) {
  const { data, mode, farmId, profile, role, search, notify } = useApp();
  const [records, setRecords] = useState<DemoMonitoredInspection[]>([]);
  const [problems, setProblems] = useState<SanitaryProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(false);
  const [followUp, setFollowUp] = useState<Inspection | undefined>();
  const [monitoringPlan, setMonitoringPlan] = useState<MonitoringPlan>();
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [block, setBlock] = useState('');
  const [problem, setProblem] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [catalog, setCatalog] = useState(false);
  const register = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setLoadError(''); setSelected(null); setForm(false); setCatalog(false); setMonitoringPlan(undefined); setRecords([]); setProblems([]);
    if (mode === 'demo') { setRecords(readDemo(inspectionDemoKey, demoInspections())); setProblems(loadSanitaryProblemsDemo().filter(problem => problem.active)); setLoading(false); return; }
    Promise.all([api.inspections(farmId), api.sanitaryProblems(farmId)]).then(([saved, catalog]) => { if (active) { setRecords(saved); setProblems(catalog); } })
      .catch(failure => { if (active) setLoadError(failure instanceof Error ? failure.message : 'No se pudieron cargar las inspecciones y el catálogo.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [farmId, mode]);
  function persist(next: DemoMonitoredInspection[]) {
    if (mode === 'demo' && !saveDemo(inspectionDemoKey, next)) throw new Error('No se pudo guardar la demostración.');
    setRecords(next);
  }
  async function create(payload: NewInspection) {
    const saved: Inspection = mode === 'live' ? await api.createInspection(payload) : {
      ...payload, id: Math.max(0, ...records.map(record => record.id)) + 1, farmId,
      problemName: problems.find(item => item.code === payload.problemCode)?.name ?? followUp?.problemName ?? payload.problemCode,
      incidencePercent: incidence(payload.inspectedPlants, payload.affectedPlants),
      assessmentStatus: 'SUSPECTED', resolved: false, createdByUserId: profile.user.id,
      inspectorName: profile.user.name, version: 0,
    };
    persist([mode === 'demo' ? addDemoMonitoringAlert(saved) : saved, ...records]); setForm(false); notify('Inspección registrada.');
  }
  function updateRecord(saved: Inspection) {
    // Demo threshold alerts are stored with their source inspection.
    persist(records.map(record => record.id === saved.id ? { ...record, ...saved } : record));
  }
  function reviewDemoAlert(alert: MonitoringAlert) {
    const source = records.find(record => record.id === alert.inspectionId);
    if (!source) throw new Error('No se encontró la inspección de origen.');
    persist(records.map(record => record.id === source.id ? { ...record, demoMonitoringAlert: alert } : record));
  }
  function showInspectionForm(options: { followUp?: Inspection; plan?: MonitoringPlan } = {}) {
    setFollowUp(options.followUp);
    setMonitoringPlan(options.plan);
    setForm(true);
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || selected.canceledAt || reviewBusy) return;
    const fields = new FormData(event.currentTarget);
    const payload = { assessmentStatus: String(fields.get('assessmentStatus')) as AssessmentStatus, resolved: fields.get('resolved') === 'on', reviewNotes: String(fields.get('reviewNotes')).trim(), version: selected.version };
    setError(''); setReviewBusy(true);
    try {
      if (!selected.affectedPlants && payload.assessmentStatus === 'CONFIRMED') throw new Error('No se puede confirmar una afectación sin plantas afectadas.');
      const saved = mode === 'live' ? await api.reviewInspection(selected.id, payload) : { ...selected, ...payload, reviewedByUserId: profile.user.id, reviewedAt: new Date().toISOString(), version: selected.version + 1 };
      updateRecord(saved); setSelected(null); notify('Revisión guardada.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); } finally { setReviewBusy(false); }
  }
  const filtered = records.filter(record => record.farmId === farmId && (!block || record.blockId === Number(block)) && (!problem || record.problemCode === problem)
    && (!from || record.inspectedAt >= new Date(`${from}T00:00:00`).toISOString()) && (!to || record.inspectedAt <= new Date(`${to}T23:59:59.999`).toISOString())
    && `${record.problemName} ${record.symptoms} ${record.inspectorName}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((first, second) => second.inspectedAt.localeCompare(first.inspectedAt) || second.id - first.id);
  const farmRecords = records.filter(record => record.farmId === farmId);
  const blockLabel = (id: number) => data.blocks.find(item => item.id === id)?.code ?? `Bloque #${id}`;
  const rowLabel = (id?: number | null) => id == null ? 'Todo el bloque' : data.rows.find(item => item.id === id)?.rowCode ?? `Surco #${id}`;
  const openRecord = (record: Inspection | null) => { setError(''); setSelected(record); };
  const showRegister = () => register.current?.focus();
  function exportCsv() {
    const content = inspectionCsv(filtered, id => data.blocks.find(item => item.id === id)?.code ?? String(id), id => data.rows.find(item => item.id === id)?.rowCode ?? String(id));
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `inspecciones-${mode}-${localDate()}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exportadas ${filtered.length} inspecciones.`);
  }
  return <>
    <header className="page-heading inspection-heading">
      <div><h1>Plagas y enfermedades</h1><p>Monitorea los hallazgos, registra inspecciones y consulta el seguimiento de cada caso.</p></div>
      {!monitoring && <div className="heading-buttons">
        <button className="button secondary" onClick={showRegister}><ClipboardList size={17} />Registro de inspección</button>
        <button className="button secondary" disabled={loading || !!loadError} onClick={() => setCatalog(true)}><Bug size={17} />Catálogo de plagas</button>
        <button className="button" disabled={!data.blocks.length || !problems.length || loading} onClick={() => showInspectionForm()}><Plus size={17} />Nueva inspección</button>
      </div>}
    </header>
    {navigation}
    {loadError && <p className="form-error" role="alert">{loadError}</p>}
    {error && !selected && <p className="form-error" role="alert">{error}</p>}
    {monitoring ? (loading ? <Loading /> : <InspectionMonitoring problems={problems} records={records}
      onRegister={plan => showInspectionForm({ plan })}
      onOpenInspection={id => openRecord(records.find(record => record.id === id) ?? null)}
      onReviewDemo={reviewDemoAlert} />) : <>
    {!loading && !loadError && <InspectionOverview records={farmRecords} problems={problems} onOpen={openRecord} onShowRegister={showRegister} />}
    <Panel className="inspection-register">
      <div className="inspection-register-header">
        <div><h2 ref={register} tabIndex={-1}>Inspecciones fitosanitarias</h2><p>Historial de hallazgos, evaluaciones y próximas visitas.</p></div>
        <button className="button secondary" disabled={!filtered.length} onClick={exportCsv}><Download size={16} />Exportar inspecciones CSV</button>
      </div>
      <div className="record-filters inspection-filters">
        <label>Bloque<select value={block} onChange={event => setBlock(event.target.value)}><option value="">Todos los bloques</option>{data.blocks.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
        <label>Problema<select value={problem} onChange={event => setProblem(event.target.value)}><option value="">Todos los problemas</option>{problems.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
        <label>Desde<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
        <label>Hasta<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
      </div>
      {loading ? <Loading /> : loadError ? null : filtered.length ? <div className="table-wrap inspection-table" tabIndex={0} role="region" aria-label="Historial de inspecciones">
        <table role="table"><thead role="rowgroup"><tr role="row"><th scope="col">Problema y ubicación</th><th scope="col">Fecha y responsable</th><th scope="col">Incidencia</th><th scope="col">Severidad y área</th><th scope="col">Evaluación</th><th scope="col">Próxima visita</th><th scope="col">Detalle</th></tr></thead>
          <tbody role="rowgroup">{filtered.map(record => <tr key={record.id} role="row">
            <td role="cell"><strong>{record.problemName}</strong><small className="table-subtitle">{blockLabel(record.blockId)} · {rowLabel(record.rowId)}</small></td>
            <td role="cell" data-heading="Fecha y responsable">{new Date(record.inspectedAt).toLocaleDateString('es-CO')}<small className="table-subtitle">{record.inspectorName}</small></td>
            <td role="cell" data-heading="Incidencia"><strong>{number(record.incidencePercent, 1)} %</strong><small className="table-subtitle">{number(record.affectedPlants)} de {number(record.inspectedPlants)} plantas</small></td>
            <td role="cell" data-heading="Severidad y área">{number(record.severityPercent, 1)} %<small className="table-subtitle">{record.affectedAreaHa == null ? 'Área sin dato' : `${number(record.affectedAreaHa, 3)} ha`}</small></td>
            <td role="cell" data-heading="Evaluación"><InspectionStatus record={record} /></td>
            <td role="cell" data-heading="Próxima visita">{visitDate(record.nextVisit)}{!record.canceledAt && record.nextVisit < localDate() && !record.resolved && record.assessmentStatus !== 'DISCARDED' && <small className="table-subtitle inspection-overdue">Visita vencida</small>}</td>
            <td role="cell"><button className="button secondary" aria-label={`Ver inspección ${record.id}`} onClick={() => openRecord(record)}><Eye size={17} />Ver detalle</button></td>
          </tr>)}</tbody>
        </table>
      </div> : <Empty title="Sin inspecciones" description="Registra una inspección o cambia los filtros." />}
    </Panel>
    </>}
    {catalog && <Modal title="Catálogo de plagas y enfermedades" className="inspection-modal" wide onClose={() => setCatalog(false)}>
      <div className="inspection-dialog-body">
        {problems.length ? <ul className="inspection-catalog">{problems.map(item => <li key={item.code}><Bug size={18} /><strong>{item.name}</strong><Badge tone={item.category === 'PEST' ? 'gold' : 'neutral'}>{item.category === 'PEST' ? 'Plaga' : 'Enfermedad'}</Badge></li>)}</ul>
          : <Empty title="Catálogo vacío" description="Aún no hay problemas fitosanitarios disponibles." />}
      </div>
    </Modal>}
    {form && <InspectionForm problems={problems} followUp={followUp} monitoringPlan={monitoringPlan} onSave={create} onClose={() => setForm(false)} />}
    {selected && <Modal key={selected.id} title="Detalle de inspección" className="inspection-modal" wide onClose={() => !reviewBusy && setSelected(null)}>
      <div className="inspection-dialog-body">
        <div className="inspection-detail-summary">
          <div className="inspection-detail-heading"><div><span>Inspección #{selected.id}</span><h3>{selected.problemName}</h3></div><InspectionStatus record={selected} /></div>
          <div className="inspection-detail-context"><span><MapPin size={17} />{blockLabel(selected.blockId)} · {rowLabel(selected.rowId)}</span><span><CalendarDays size={17} />{new Date(selected.inspectedAt).toLocaleString('es-CO')}</span><span>{selected.inspectorName}</span></div>
        </div>
        <dl className="inspection-detail-metrics">
          <div><dt>Incidencia</dt><dd>{number(selected.incidencePercent, 1)} %<span>{number(selected.affectedPlants)} de {number(selected.inspectedPlants)} plantas</span></dd></div>
          <div><dt>Severidad</dt><dd>{number(selected.severityPercent, 1)} %</dd></div>
          <div><dt>Área afectada</dt><dd>{selected.affectedAreaHa == null ? 'Sin dato' : `${number(selected.affectedAreaHa, 3)} ha`}</dd></div>
          <div><dt>Próxima visita</dt><dd>{visitDate(selected.nextVisit)}</dd></div>
        </dl>
        <section className="inspection-detail-section">
          <h3>Hallazgos en campo</h3>
          <dl className="inspection-detail-copy"><div><dt>Síntomas observados</dt><dd>{selected.symptoms}</dd></div><div><dt>Método de evaluación</dt><dd>{selected.severityMethod}</dd></div>
            {selected.reviewNotes && <div><dt>Última revisión</dt><dd>{selected.reviewNotes}{selected.reviewedAt && <time dateTime={selected.reviewedAt}>{new Date(selected.reviewedAt).toLocaleString('es-CO')}</time>}</dd></div>}
          </dl>
        </section>
        {!selected.canceledAt && role !== 'WORKER' && <section className="inspection-detail-section">
          <h3>Evaluación del hallazgo</h3>
          <form className="inspection-review-form" onSubmit={review}>
            <label>Estado de evaluación<select name="assessmentStatus" defaultValue={selected.assessmentStatus}>{Object.entries(assessmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="inspection-checkbox"><input type="checkbox" name="resolved" defaultChecked={selected.resolved} /> Hallazgo resuelto</label>
            <label className="inspection-full-row">Justificación de la revisión<textarea name="reviewNotes" required maxLength={4000} defaultValue={selected.reviewNotes ?? ''} /></label>
            {error && <p role="alert" className="form-error inspection-full-row">{error}</p>}
            <div className="form-actions inspection-full-row"><button className="button" disabled={reviewBusy}>Guardar revisión</button></div>
          </form>
        </section>}
        <InspectionActions key={selected.id} inspection={selected} related={records} onOpen={id => openRecord(records.find(record => record.id === id) ?? null)} onUpdate={saved => { updateRecord(saved); setSelected(saved); }} onFollowUp={() => { showInspectionForm({ followUp: selected }); setSelected(null); }} onBusyChange={setReviewBusy} />
      </div>
    </Modal>}
  </>;
}

function InspectionForm({ problems, followUp, monitoringPlan, onSave, onClose }: { problems: SanitaryProblem[]; followUp?: Inspection; monitoringPlan?: MonitoringPlan; onSave: (payload: NewInspection) => Promise<void>; onClose: () => void }) {
  const { data, mode } = useApp();
  const [blockId, setBlockId] = useState(String(followUp?.blockId ?? monitoringPlan?.blockId ?? ''));
  const [inspected, setInspected] = useState(20);
  const [affected, setAffected] = useState(0);
  const [affectedAreaHa, setAffectedAreaHa] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const localTime = `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const targetProblem = followUp?.problemCode ?? monitoringPlan?.problemCode;
  const nextVisit = monitoringPlan ? followingMonitoringWindow(monitoringPlan, monitoringDate(now))
    : localDate(new Date(now.getTime() + 7 * 86400000));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const fields = new FormData(event.currentTarget);
    try {
      incidence(inspected, affected);
      const payload: NewInspection = { blockId: Number(blockId), rowId: followUp?.rowId ?? (fields.get('rowId') ? Number(fields.get('rowId')) : null),
        parentInspectionId: followUp?.id, problemCode: targetProblem ?? String(fields.get('problemCode')), inspectedAt: new Date(String(fields.get('inspectedAt'))).toISOString(),
        inspectedPlants: inspected, affectedPlants: affected, affectedAreaHa, symptoms: String(fields.get('symptoms')).trim(),
        severityPercent: Number(fields.get('severityPercent')), severityMethod: String(fields.get('severityMethod')).trim(), nextVisit: String(fields.get('nextVisit')) };
      if (!affected && payload.severityPercent !== 0) throw new Error('Sin plantas afectadas la severidad debe ser cero.');
      if (payload.nextVisit < payload.inspectedAt.slice(0, 10)) throw new Error('La próxima visita no puede ser anterior a la inspección.');
      if (monitoringPlan && payload.inspectedAt.slice(0, 10) < monitoringPlan.startDate) {
        throw new Error('La visita debe realizarse a partir del inicio del plan de monitoreo.');
      }
      setBusy(true); await onSave(payload);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo registrar.'); } finally { setBusy(false); }
  }
  const problemList = followUp && !problems.some(item => item.code === followUp.problemCode)
    ? [...problems, { code: followUp.problemCode, name: followUp.problemName }]
    : problems;
  return <Modal title="Nueva inspección fitosanitaria" className="inspection-modal" wide onClose={() => !busy && onClose()}>
    <form className="inspection-dialog-body inspection-editor" onSubmit={submit}>
      {mode === 'demo' && <Notice>Se guardará en la demostración de este navegador.</Notice>}
      {followUp && <p className="inspection-follow-up">Seguimiento de inspección #{followUp.id}</p>}
      {monitoringPlan && <p className="inspection-follow-up">Visita del plan de monitoreo #{monitoringPlan.id}</p>}
      <fieldset>
        <legend>Ubicación y fecha</legend>
        <div className="inspection-form-grid">
          <label>Bloque<select required disabled={!!targetProblem} value={blockId} onChange={event => setBlockId(event.target.value)}><option value="">Seleccionar bloque</option>{data.blocks.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
          <label>Surco<select name="rowId" key={blockId} disabled={!!followUp} defaultValue={followUp?.rowId ?? ''}><option value="">Todo el bloque</option>{data.rows.filter(item => item.block.id === Number(blockId)).map(item => <option key={item.id} value={item.id}>{item.rowCode}</option>)}</select></label>
          <label>Problema sospechado<select name="problemCode" disabled={!!targetProblem} defaultValue={targetProblem}>{problemList.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
          <label>Fecha de inspección<input type="datetime-local" name="inspectedAt" required max={localTime} defaultValue={localTime} /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Muestra y daño</legend>
        <div className="inspection-form-grid">
          <label>Plantas inspeccionadas<input type="number" min={1} step={1} required value={inspected} onChange={event => setInspected(Number(event.target.value))} /></label>
          <label>Plantas afectadas<input type="number" min={0} max={inspected} step={1} required value={affected} onChange={event => setAffected(Number(event.target.value))} /></label>
          <p role="status" className="inspection-incidence inspection-full-row">Incidencia: {inspected > 0 && affected >= 0 && affected <= inspected ? `${number(affected / inspected * 100, 1)} %` : 'Revisa los conteos'}</p>
          <label>Área afectada (ha)<input name="affectedAreaHa" type="number" min={0} step="0.001" required value={affectedAreaHa} onChange={event => setAffectedAreaHa(Number(event.target.value))} /></label>
          <label>Severidad del daño (%)<input name="severityPercent" type="number" min={0} max={100} step="any" required defaultValue={0} /></label>
          <label>Síntomas observados<textarea name="symptoms" required maxLength={4000} placeholder="Describe los síntomas o indica si la muestra estaba sana." /></label>
          <label>Método de evaluación<textarea name="severityMethod" required maxLength={250} placeholder="Indica el tejido evaluado y cómo estimaste el daño." /></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Seguimiento</legend>
        <div className="inspection-form-grid">
          <label>Próxima visita<input name="nextVisit" type="date" required defaultValue={nextVisit} /></label>
          <p className="inspection-form-hint">Guarda la inspección para agregar fotos y registrar tratamientos desde el detalle.</p>
        </div>
      </fieldset>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="form-actions inspection-editor-footer"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar inspección'}</button></div>
    </form>
  </Modal>;
}
