import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Eye, Download } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { localDate, number } from '../lib/domain';
import { readDemo, saveDemo } from '../lib/demo';
import { assessmentLabels, demoInspections, incidence, inspectionCsv, inspectionDemoKey, sanitaryProblems } from '../lib/inspections';
import type { Inspection, NewInspection, SanitaryProblem, AssessmentStatus } from '../lib/inspections';
import { Badge, Empty, Modal, Notice, Panel } from '../components/ui';
import InspectionActions from '../components/InspectionActions';

export default function Inspections() {
  const { data, mode, farmId, profile, role, search, notify } = useApp();
  const [records, setRecords] = useState<Inspection[]>([]);
  const [problems, setProblems] = useState<SanitaryProblem[]>(sanitaryProblems);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(false);
  const [followUp, setFollowUp] = useState<Inspection | undefined>();
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [block, setBlock] = useState('');
  const [problem, setProblem] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setSelected(null); setForm(false); setRecords([]);
    if (mode === 'demo') { setRecords(readDemo(inspectionDemoKey, demoInspections())); setProblems(sanitaryProblems); setLoading(false); return; }
    Promise.all([api.inspections(farmId), api.sanitaryProblems()]).then(([saved, catalog]) => { if (active) { setRecords(saved); setProblems(catalog); } })
      .catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [farmId, mode]);
  function persist(next: Inspection[]) {
    if (mode === 'demo' && !saveDemo(inspectionDemoKey, next)) throw new Error('No se pudo guardar la demostración.');
    setRecords(next);
  }
  async function create(payload: NewInspection) {
    const saved: Inspection = mode === 'live' ? await api.createInspection(payload) : {
      ...payload, id: Math.max(0, ...records.map(record => record.id)) + 1, farmId,
      problemName: problems.find(item => item.code === payload.problemCode)!.name,
      incidencePercent: incidence(payload.inspectedPlants, payload.affectedPlants),
      assessmentStatus: 'SUSPECTED', resolved: false, createdByUserId: profile.user.id,
      inspectorName: profile.user.name, version: 0,
    };
    persist([saved, ...records]); setForm(false); notify('Inspección registrada.');
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || selected.canceledAt || reviewBusy) return;
    const fields = new FormData(event.currentTarget);
    const payload = { assessmentStatus: String(fields.get('assessmentStatus')) as AssessmentStatus, resolved: fields.get('resolved') === 'on', reviewNotes: String(fields.get('reviewNotes')).trim(), version: selected.version };
    setError(''); setReviewBusy(true);
    try {
      if (!selected.affectedPlants && payload.assessmentStatus === 'CONFIRMED') throw new Error('No se puede confirmar una afectación sin plantas afectadas.');
      const saved = mode === 'live' ? await api.reviewInspection(selected.id, payload) : { ...selected, ...payload, reviewedByUserId: profile.user.id, reviewedAt: new Date().toISOString(), version: selected.version + 1 };
      persist(records.map(record => record.id === saved.id ? saved : record)); setSelected(null); notify('Revisión guardada.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); } finally { setReviewBusy(false); }
  }
  const filtered = records.filter(record => record.farmId === farmId && (!block || record.blockId === Number(block)) && (!problem || record.problemCode === problem)
    && (!from || record.inspectedAt >= new Date(`${from}T00:00:00`).toISOString()) && (!to || record.inspectedAt <= new Date(`${to}T23:59:59.999`).toISOString())
    && `${record.problemName} ${record.symptoms} ${record.inspectorName}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')))
    .sort((first, second) => second.inspectedAt.localeCompare(first.inspectedAt) || second.id - first.id);
  function exportCsv() {
    const content = inspectionCsv(filtered, id => data.blocks.find(item => item.id === id)?.code ?? String(id), id => data.rows.find(item => item.id === id)?.rowCode ?? String(id));
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `inspecciones-${mode}-${localDate()}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`Exportadas ${filtered.length} inspecciones.`);
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">MONITOREO FITOSANITARIO</span><h1>Inspecciones fitosanitarias</h1><p>Registra la muestra, revisa los hallazgos y programa el seguimiento.</p></div><div className="heading-buttons"><button className="button secondary" disabled={!filtered.length} onClick={exportCsv}><Download size={16} />Exportar inspecciones CSV</button><button className="button" disabled={!data.blocks.length || loading} onClick={() => { setFollowUp(undefined); setForm(true); }}><Plus size={16} />Nueva inspección</button></div></div>
    <Notice>{mode === 'demo' ? 'Datos de demostración guardados en este navegador. ' : ''}La incidencia mide plantas afectadas; la severidad mide daño porcentual según el método registrado. Una observación no confirma el diagnóstico.</Notice>
    {error && !selected && <p className="form-error" role="alert">{error}</p>}
    <div className="record-filters"><label>Bloque<select value={block} onChange={event => setBlock(event.target.value)}><option value="">Todos</option>{data.blocks.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label><label>Problema<select value={problem} onChange={event => setProblem(event.target.value)}><option value="">Todos</option>{problems.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><label>Desde<input type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label></div>
    <Panel><div className="table-wrap"><table><thead><tr><th>Fecha / responsable</th><th>Ubicación</th><th>Problema</th><th>Muestra / incidencia</th><th>Severidad</th><th>Evaluación</th><th>Próxima visita</th><th>Detalle</th></tr></thead><tbody>{filtered.map(record => <tr key={record.id}><td>{new Date(record.inspectedAt).toLocaleDateString('es-CO')}<small className="table-subtitle">{record.inspectorName}</small></td><td>{data.blocks.find(item => item.id === record.blockId)?.code}<small className="table-subtitle">{data.rows.find(item => item.id === record.rowId)?.rowCode ?? 'Todo el bloque'}</small></td><td>{record.problemName}</td><td>{record.affectedPlants} / {record.inspectedPlants}<small className="table-subtitle">{number(record.incidencePercent, 1)} %</small></td><td>{number(record.severityPercent, 1)} %<small className="table-subtitle">{record.severityMethod}</small></td><td><Badge tone={record.resolved || record.assessmentStatus === 'DISCARDED' ? 'neutral' : 'gold'}>{record.canceledAt ? 'Anulada' : assessmentLabels[record.assessmentStatus]}</Badge>{!record.canceledAt && record.resolved && <small className="table-subtitle">Resuelta</small>}</td><td>{record.nextVisit}{!record.canceledAt && record.nextVisit < localDate() && !record.resolved && record.assessmentStatus !== 'DISCARDED' && <small className="table-subtitle">Visita vencida</small>}</td><td><button className="icon-button" aria-label={`Ver inspección ${record.id}`} onClick={() => { setError(''); setSelected(record); }}><Eye size={18} /></button></td></tr>)}</tbody></table>{loading ? <p role="status">Cargando inspecciones…</p> : !filtered.length && <Empty title="Sin inspecciones" description="Registra una inspección o cambia los filtros." />}</div></Panel>
    {form && <InspectionForm problems={problems} followUp={followUp} onSave={create} onClose={() => setForm(false)} />}
    {selected && <Modal key={selected.id} title="Detalle de inspección" onClose={() => !reviewBusy && setSelected(null)}><div className="form-stack"><h3>{selected.problemName}</h3><p>{selected.symptoms}</p><p>Incidencia: {number(selected.incidencePercent, 1)} % · Severidad: {number(selected.severityPercent, 1)} %</p><p>Método: {selected.severityMethod}</p><p>Próxima visita: {selected.nextVisit}</p><p>{assessmentLabels[selected.assessmentStatus]}{selected.resolved ? ' · Resuelta' : ''}</p>{selected.reviewNotes && <p>Revisión: {selected.reviewNotes}</p>}{!selected.canceledAt && role !== 'WORKER' && <form className="form-stack" onSubmit={review}><label>Estado de evaluación<select name="assessmentStatus" defaultValue={selected.assessmentStatus}>{Object.entries(assessmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><input type="checkbox" name="resolved" defaultChecked={selected.resolved} /> Hallazgo resuelto</label><label>Justificación de la revisión<textarea name="reviewNotes" required maxLength={4000} defaultValue={selected.reviewNotes ?? ''} /></label><button className="button" disabled={reviewBusy}>Guardar revisión</button></form>}<InspectionActions inspection={selected} related={records} onOpen={id => { setError(''); setSelected(records.find(record => record.id === id) ?? null); }} onUpdate={saved => { persist(records.map(record => record.id === saved.id ? saved : record)); setSelected(saved); }} onFollowUp={() => { setFollowUp(selected); setSelected(null); setForm(true); }} onBusyChange={setReviewBusy} />{error && <p role="alert" className="form-error">{error}</p>}</div></Modal>}
  </>;
}

function InspectionForm({ problems, followUp, onSave, onClose }: { problems: SanitaryProblem[]; followUp?: Inspection; onSave: (payload: NewInspection) => Promise<void>; onClose: () => void }) {
  const { data, mode } = useApp();
  const [blockId, setBlockId] = useState(followUp ? String(followUp.blockId) : '');
  const [inspected, setInspected] = useState(20);
  const [affected, setAffected] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const now = new Date();
  const localTime = `${localDate(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const fields = new FormData(event.currentTarget);
    try {
      incidence(inspected, affected);
      const payload: NewInspection = { blockId: Number(blockId), rowId: followUp?.rowId ?? (fields.get('rowId') ? Number(fields.get('rowId')) : null),
        parentInspectionId: followUp?.id, problemCode: followUp?.problemCode ?? String(fields.get('problemCode')), inspectedAt: new Date(String(fields.get('inspectedAt'))).toISOString(),
        inspectedPlants: inspected, affectedPlants: affected, symptoms: String(fields.get('symptoms')).trim(),
        severityPercent: Number(fields.get('severityPercent')), severityMethod: String(fields.get('severityMethod')).trim(), nextVisit: String(fields.get('nextVisit')) };
      if (!affected && payload.severityPercent !== 0) throw new Error('Sin plantas afectadas la severidad debe ser cero.');
      if (payload.nextVisit < payload.inspectedAt.slice(0, 10)) throw new Error('La próxima visita no puede ser anterior a la inspección.');
      setBusy(true); await onSave(payload);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo registrar.'); } finally { setBusy(false); }
  }
  return <Modal title="Nueva inspección fitosanitaria" onClose={() => !busy && onClose()}><form className="form-stack" onSubmit={submit}>
    <p className="muted">Después de guardar, abre el detalle para adjuntar fotos a la inspección o sus tratamientos.</p>
    {mode === 'demo' && <Notice>Se guardará en la demostración de este navegador.</Notice>}
    {followUp && <p>Seguimiento de inspección #{followUp.id}</p>}
    <label>Bloque<select required disabled={!!followUp} value={blockId} onChange={event => setBlockId(event.target.value)}><option value="">Seleccionar bloque</option>{data.blocks.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}</select></label>
    <label>Surco<select name="rowId" key={blockId} disabled={!!followUp} defaultValue={followUp?.rowId ?? ''}><option value="">Todo el bloque</option>{data.rows.filter(item => item.block.id === Number(blockId)).map(item => <option key={item.id} value={item.id}>{item.rowCode}</option>)}</select></label>
    <label>Problema sospechado<select name="problemCode" disabled={!!followUp} defaultValue={followUp?.problemCode}>{problems.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <label>Fecha de inspección<input type="datetime-local" name="inspectedAt" required max={localTime} defaultValue={localTime} /></label>
    <div className="form-grid"><label>Plantas inspeccionadas<input type="number" min={1} step={1} required value={inspected} onChange={event => setInspected(Number(event.target.value))} /></label><label>Plantas afectadas<input type="number" min={0} max={inspected} step={1} required value={affected} onChange={event => setAffected(Number(event.target.value))} /></label></div>
    <p role="status">Incidencia: {inspected > 0 && affected >= 0 && affected <= inspected ? `${number(affected / inspected * 100, 1)} %` : 'Revisa los conteos'}</p>
    <label>Síntomas observados<textarea name="symptoms" required maxLength={4000} placeholder="Describe los síntomas o indica que no se observaron." /></label>
    <label>Severidad del daño (%)<input name="severityPercent" type="number" min={0} max={100} step="any" required defaultValue={0} /></label>
    <label>Método de evaluación<textarea name="severityMethod" required maxLength={250} placeholder="Indica el tejido, daño y método usados para estimar el porcentaje." /></label>
    <label>Próxima visita<input name="nextVisit" type="date" required defaultValue={localDate(new Date(now.getTime() + 7 * 86400000))} /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button><button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar inspección'}</button></div>
  </form></Modal>;
}
