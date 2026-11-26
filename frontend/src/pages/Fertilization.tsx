import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ArrowRight, CalendarDays, ClipboardCheck, ClipboardList, Download, FilePlus2, FlaskConical, History, Layers3, LayoutDashboard, PackageCheck, Plus, Sprout } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { saveDemo } from '../lib/demo';
import { localDate, csvCell, number } from '../lib/domain';
import { nutrientNames, units, doseUnits, quantityUnit, coverageUnit, totalQuantity, planLabels, recurrenceLabels, fertilizationKey, readFertilizationDemo, interpretAnalysis, nutrientStatusTones } from '../lib/fertilization';
import type { Analysis, FertilizerProduct, FertilizationPlan, FertilizationApplication, FertilizationData, SoilResult, Nutrient, NutrientInterpretation, NutrientReferenceProfile } from '../lib/fertilization';
import type { Member } from '../lib/types';
import { demoInspections, inspectionDemoKey } from '../lib/inspections';
import { readDemo } from '../lib/demo';
import { Badge, Modal, Notice, Panel } from '../components/ui';
import PhotoGallery from '../components/PhotoGallery';
import FertilizationContext from '../components/FertilizationContext';
import FertilizationOverview from '../components/FertilizationOverview';
import '../fertilization.css';

type Editor = { kind: 'analysis' } | { kind: 'profile' } | { kind: 'product' } | { kind: 'review'; analysis: Analysis } | { kind: 'plan'; sample?: Analysis } | { kind: 'application' | 'approve' | 'cancel' | 'followup'; plan: FertilizationPlan };
const empty: FertilizationData = { analyses: [], plans: [], applications: [] };
const fertilizationTabs = [
  { id: 'overview', label: 'Resumen', icon: LayoutDashboard },
  { id: 'analyses', label: 'Análisis', icon: FlaskConical },
  { id: 'plans', label: 'Planes', icon: ClipboardList },
  { id: 'applications', label: 'Aplicaciones', icon: Sprout },
] as const;
const editorTitles: Record<Editor['kind'], string> = {
  analysis: 'Nuevo análisis',
  profile: 'Nuevo perfil nutricional',
  product: 'Nuevo producto fertilizante',
  review: 'Revisión técnica del análisis',
  plan: 'Nuevo plan de fertilización',
  application: 'Registrar aplicación',
  followup: 'Seguimiento técnico',
  approve: 'Aprobar plan',
  cancel: 'Anular plan',
};
const shortDate = (date: string) => new Date(date.length === 10 ? `${date}T00:00:00` : date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
const timeLabel = (date: string) => new Date(date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="fertilization-form-section"><legend>{title}</legend><div className="fertilization-form-grid">{children}</div></fieldset>;
}

function RecordDetails({ entries }: { entries: [string, ReactNode][] }) {
  return <dl className="detail-list farm-work-details">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function RecordNotes({ title, children }: { title: string; children: ReactNode }) {
  return <div className="fertilization-record-notes"><h4>{title}</h4><p>{children}</p></div>;
}

function RecordContext({ icon: Icon, title, subtitle, children }: { icon: typeof Sprout; title: string; subtitle: string; children?: ReactNode }) {
  return <div className="farm-work-context">
    <span className="farm-work-context-icon"><Icon size={24} /></span>
    <div className="fertilization-context-copy"><strong>{title}</strong><small>{subtitle}</small></div>
    {children && <div className="farm-work-context-amount">{children}</div>}
  </div>;
}

function PlanProgress({ plan }: { plan: FertilizationPlan }) {
  const progress = plan.totalQuantity > 0 ? Math.min(100, Math.round(plan.appliedQuantity / plan.totalQuantity * 100)) : 0;
  return <div className="fertilization-progress">
    <strong>{plan.totalQuantity} / {plan.appliedQuantity} {quantityUnit(plan.doseUnit)}</strong>
    <progress max={100} value={progress} aria-label="Porcentaje de la cantidad aplicada" />
  </div>;
}

function InterpretationBadge({ interpretation }: { interpretation: NutrientInterpretation }) {
  return <Badge tone={nutrientStatusTones[interpretation.status]}>{interpretation.label}</Badge>;
}

function AnalysisInterpretation({ analysis, crop }: { analysis: Analysis; crop?: string }) {
  const summary = interpretAnalysis(analysis, crop);
  const profile = summary.interpretations.find(item => item.profileName);
  const detail = summary.attention ? `${summary.attention} resultado${summary.attention === 1 ? '' : 's'} por revisar` : `${summary.adequate} resultado${summary.adequate === 1 ? '' : 's'} en rango`;
  const representative = summary.interpretations.find(item => item.status === 'LOW' || item.status === 'HIGH') ?? summary.interpretations[0];
  return <div className="nutrient-interpretation-summary">{representative && <InterpretationBadge interpretation={representative} />}<span>{detail}</span>{summary.unknown > 0 && <small>{summary.unknown} sin perfil compatible</small>}{profile && <small>{profile.profileName} · requiere revisión técnica</small>}</div>;
}

function AnalysisInterpretationDetails({ analysis, crop, canReview, onReview }: { analysis: Analysis; crop?: string; canReview: boolean; onReview: () => void }) {
  const summary = interpretAnalysis(analysis, crop);
  const profile = summary.interpretations.find(item => item.profileName);
  return <Panel title="Interpretación preliminar" action={canReview && <button className="button small" onClick={onReview}>{analysis.review ? 'Actualizar revisión' : 'Registrar revisión'}</button>}>
    <p className="muted">Los estados usan el perfil nutricional de la finca.</p>
    <div className="table-wrap"><table>
      <thead><tr><th scope="col">Parámetro</th><th scope="col">Estado</th><th scope="col">Fundamento</th></tr></thead>
      <tbody>{summary.interpretations.map(interpretation => <tr key={interpretation.nutrient}>
        <td><strong>{nutrientNames[interpretation.nutrient]}</strong><small>{interpretation.value} {units[interpretation.unit]}</small></td>
        <td><InterpretationBadge interpretation={interpretation} /></td><td>{interpretation.reason}</td>
      </tr>)}</tbody>
    </table></div>
    {profile && <p className="muted">{profile.profileName} · {profile.profileVersion}. {profile.source}</p>}
    {analysis.review && <RecordNotes title={analysis.review.decision === 'CONFIRMED' ? 'Revisión confirmada' : analysis.review.decision === 'REJECTED' ? 'Revisión rechazada' : 'Requiere seguimiento'}>{analysis.review.notes} · Usuario #{analysis.review.reviewedBy}</RecordNotes>}
  </Panel>;
}

export default function Fertilization({ onHistory }: { onHistory: () => void }) {
  const app = useApp();
  const { mode, farmId, data, role, profile, notify } = app;
  const demo = mode === 'demo';
  const manager = role === 'ADMIN' || role === 'SUPERVISOR';
  const agronomic = role === 'ADMIN' || role === 'SUPERVISOR' || role === 'AGRONOMIST';
  const [records, setRecords] = useState<FertilizationData>(empty);
  const [referenceProfiles, setReferenceProfiles] = useState<NutrientReferenceProfile[]>([]);
  const [products, setProducts] = useState<FertilizerProduct[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [inspectionOptions, setInspectionOptions] = useState<{ id: number; blockId: number; problemCode: string }[]>([]);
  const [tab, setTab] = useState<typeof fertilizationTabs[number]['id']>('overview');
  const [blockFilter, setBlockFilter] = useState('');
  const [choosingApplication, setChoosingApplication] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const [detail, setDetail] = useState<Analysis | FertilizationPlan | FertilizationApplication>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setRecords(empty); setDetail(undefined); setEditor(undefined); setChoosingApplication(false);
    const inspections = demo ? Promise.resolve(readDemo(inspectionDemoKey, demoInspections())) : api.inspections(farmId);
    const people = demo ? Promise.resolve([{ userId: 1, name: profile.user.name, email: profile.user.email, role: 'ADMIN' as const }, { userId: 2, name: 'María González', email: 'maria@demo.local', role: 'WORKER' as const }]) : manager ? api.members(farmId) : Promise.resolve([]);
    Promise.all([demo ? Promise.resolve(readFertilizationDemo()) : api.fertilization(farmId), people, inspections, demo ? Promise.resolve([] as NutrientReferenceProfile[]) : api.nutrientProfiles(farmId), demo ? Promise.resolve([] as FertilizerProduct[]) : api.fertilizerProducts(farmId)]).then(([result, users, inspections, profiles, products]) => {
      if (active) { setRecords(result); setMembers(users); setInspectionOptions(inspections.filter(inspection => !inspection.canceledAt)); setReferenceProfiles(profiles); setProducts(products); }
    }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demo, farmId, manager, profile.user.id, profile.user.name, profile.user.email]);
  function persist(next: FertilizationData) {
    if (!saveDemo(fertilizationKey, next)) throw new Error('No se pudo guardar la demostración. Libera almacenamiento e inténtalo de nuevo.');
    setRecords(next);
  }
  async function reload() { if (!demo) setRecords(await api.fertilization(farmId)); }
  async function action(operation: () => Promise<void>) {
    setBusy(true); setError('');
    try { await operation(); setEditor(undefined); try { await reload(); } catch { throw new Error('El registro se guardó, pero no se pudo actualizar la vista. Recarga la página; no repitas la creación.'); } notify('Registro de fertilización guardado.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar.'); }
    finally { setBusy(false); }
  }
  const blockLabel = (id: number) => data.blocks.find(block => block.id === id)?.code ?? `Bloque #${id}`;
  const memberName = (id: number) => id === profile.user.id ? profile.user.name : members.find(member => member.userId === id)?.name ?? `Usuario #${id}`;
  const activeBlockFilter = data.blocks.some(block => String(block.id) === blockFilter) ? blockFilter : '';
  const selectedBlock = (id: number) => !activeBlockFilter || id === Number(activeBlockFilter);
  const analyses = records.analyses.filter(analysis => data.blocks.some(block => block.id === analysis.blockId));
  const plans = records.plans.filter(plan => data.blocks.some(block => block.id === plan.blockId));
  const applications = records.applications.filter(application => plans.some(plan => plan.id === application.planId));
  function exportCsv() {
    const rows = [['Plan', 'Bloque', 'Estado', 'Producto', 'Programado', 'Aplicado', 'Unidad', 'Seguimiento'], ...plans.filter(plan => selectedBlock(plan.blockId)).map(plan => [plan.id, blockLabel(plan.blockId), planLabels[plan.status], plan.product, plan.totalQuantity, plan.appliedQuantity, quantityUnit(plan.doseUnit), plan.followUpOn])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'fertilizacion.csv'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function generateTask(plan: FertilizationPlan) {
    await action(async () => {
      if (!demo) { await api.fertilizerAction(`plans/${plan.id}/task`); await app.refresh(true); return; }
      if (plan.taskId) return;
      const taskId = Date.now();
      persist({ ...records, plans: records.plans.map(item => item.id === plan.id ? { ...item, taskId, version: item.version + 1 } : item) });
      app.setTasks(previous => [...previous, { id: String(taskId), farmId, blockId: plan.blockId, assigneeId: plan.assigneeId, assignee: members.find(member => member.userId === plan.assigneeId)?.name ?? 'Responsable', title: `Fertilización #${plan.id} · ${plan.product}`, activity: 'fertilization', date: plan.scheduledOn, time: plan.scheduledTime, priority: 'Media', status: 'pending', version: 0, instructions: `Plan aprobado #${plan.id}. ${plan.dose} ${doseUnits[plan.doseUnit]}; ${plan.coverage} ${coverageUnit(plan.doseUnit)}. Total ${plan.totalQuantity} ${quantityUnit(plan.doseUnit)}. ${plan.method}. Seguimiento ${plan.followUpOn}.` }]);
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editor) return;
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const numeric = (key: string) => Number(text(key));
    await action(async () => {
      if (editor.kind === 'profile') {
        const ranges = (Object.keys(nutrientNames) as Nutrient[]).filter(code => text(`lower-${code}`) !== '' || text(`upper-${code}`) !== '').map(code => ({ nutrient: code, unit: text(`unit-${code}`), lowerBound: numeric(`lower-${code}`), upperBound: numeric(`upper-${code}`) }));
        if (!ranges.length || ranges.some(range => range.lowerBound < 0 || range.upperBound <= range.lowerBound)) throw new Error('Agrega al menos un rango válido; el límite superior debe ser mayor.');
        if (demo) throw new Error('Los perfiles configurables requieren una finca conectada.');
        const created = await api.fertilizerAction<NutrientReferenceProfile>('profiles', { farmId, name: text('name'), crop: text('crop'), variety: text('variety') || null, sampleType: text('sampleType'), version: text('version'), source: text('source'), ranges });
        setReferenceProfiles(previous => [created, ...previous]);
      } else if (editor.kind === 'product') {
        if (demo) throw new Error('El catálogo de fertilizantes requiere una finca conectada.');
        const created = await api.fertilizerAction<FertilizerProduct>('products', { farmId, code: text('code'), name: text('name'), composition: text('composition'), defaultDoseUnit: text('defaultDoseUnit'), notes: text('notes') || null });
        setProducts(previous => [...previous, created].sort((first, second) => first.name.localeCompare(second.name)));
      } else if (editor.kind === 'analysis') {
        const results: SoilResult[] = (Object.keys(nutrientNames) as Nutrient[]).filter(code => text(`value-${code}`) !== '').map(code => ({ nutrient: code, value: numeric(`value-${code}`), unit: text(`unit-${code}`) as SoilResult['unit'], method: text(`method-${code}`) }));
        if (!results.length || results.some(result => !result.method || result.value < 0 || (result.unit === 'PERCENT' && result.value > 100) || (result.nutrient === 'PH' && result.value > 14))) throw new Error('Indica resultados válidos y el método de cada medición.');
        if (!!text('latitude') !== !!text('longitude')) throw new Error('Indica ambas coordenadas o ninguna.');
        const payload = { blockId: numeric('blockId'), sampleType: text('sampleType'), sampledOn: text('sampledOn'), laboratory: text('laboratory'), reference: text('reference'), depthCm: numeric('depthCm'), latitude: text('latitude') ? numeric('latitude') : null, longitude: text('longitude') ? numeric('longitude') : null, results, notes: text('notes') };
        const report = form.get('report') as File;
        if (report?.size && (report.size > 10 * 1024 * 1024 || new TextDecoder().decode((await report.arrayBuffer()).slice(0, 5)) !== '%PDF-')) throw new Error('Adjunta un PDF válido de hasta 10 MB.');
        let analysis: Analysis;
        if (demo) {
          analysis = { ...payload, id: Date.now(), createdBy: profile.user.id } as unknown as Analysis;
          if (report?.size) { analysis.reportData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(report); }); analysis.hasReport = true; }
          persist({ ...records, analyses: [analysis, ...records.analyses] });
        } else {
          analysis = await api.fertilizerAction<Analysis>('analyses', payload);
          if (report?.size) {
            const upload = new FormData(); upload.append('file', report);
            try { await api.fertilizerAction(`analyses/${analysis.id}/report`, upload); }
            catch (failure) { setEditor(undefined); await reload(); throw new Error(`El análisis #${analysis.id} quedó guardado, pero falló el PDF: ${failure instanceof Error ? failure.message : 'Error de conexión'}. Puedes adjuntarlo desde su detalle.`); }
          }
        }
      } else if (editor.kind === 'review') {
        if (demo) throw new Error('La revisión persistida requiere una finca conectada.');
        await api.fertilizerAction(`analyses/${editor.analysis.id}/review`, { decision: text('decision'), notes: text('reason') });
      } else if (editor.kind === 'plan') {
        const doseUnit = text('doseUnit') as FertilizationPlan['doseUnit'];
        const payload = { blockId: numeric('blockId'), analysisId: numeric('analysisId'), inspectionId: text('inspectionId') ? numeric('inspectionId') : null, growthStage: text('growthStage'), diagnosis: text('diagnosis'), objective: text('objective'), product: text('product'), composition: text('composition'), dose: numeric('dose'), doseUnit, coverage: numeric('coverage'), method: text('method'), scheduledOn: text('scheduledOn'), scheduledTime: text('scheduledTime'), assigneeId: numeric('assigneeId'), followUpOn: text('followUpOn'), productId: text('productId') ? numeric('productId') : null, recurrence: text('recurrence') || 'NONE', recurrenceUntil: text('recurrenceUntil') || null };
        const sample = analyses.find(analysis => analysis.id === payload.analysisId);
        if (!sample || sample.blockId !== payload.blockId) throw new Error('Selecciona un análisis del mismo bloque.');
        if (payload.inspectionId && !inspectionOptions.some(inspection => inspection.id === payload.inspectionId && inspection.blockId === payload.blockId)) throw new Error('La inspección debe pertenecer al mismo bloque.');
        if (payload.scheduledOn < sample.sampledOn || payload.followUpOn < payload.scheduledOn) throw new Error('Revisa las fechas del análisis, aplicación y seguimiento.');
        if (coverageUnit(doseUnit) === 'plantas' ? !Number.isInteger(payload.coverage) : payload.coverage > (data.blocks.find(block => block.id === payload.blockId)?.areaHa ?? Infinity)) throw new Error('La cobertura debe respetar el área del bloque o ser un número entero de plantas.');
        if (demo) persist({ ...records, plans: [{ ...payload, id: Date.now(), totalQuantity: totalQuantity(payload.dose, payload.coverage, doseUnit), appliedQuantity: 0, status: 'DRAFT', version: 0, createdBy: profile.user.id, followups: [] } as FertilizationPlan, ...records.plans] });
        else await api.fertilizerAction('plans', payload);
        setTab('plans');
      } else {
        const plan = editor.plan;
        if (editor.kind === 'approve' || editor.kind === 'cancel') {
          if (demo) persist({ ...records, plans: records.plans.map(item => item.id === plan.id ? { ...item, status: editor.kind === 'approve' ? 'APPROVED' : 'CANCELED', version: item.version + 1, decisionReason: text('reason'), approvedBy: profile.user.id, approvedAt: new Date().toISOString() } : item) });
          else await api.fertilizerAction(`plans/${plan.id}/${editor.kind}`, { version: plan.version, reason: text('reason') });
        } else if (editor.kind === 'application') {
          const payload = { occurredAt: new Date(text('occurredAt')).toISOString(), quantity: numeric('quantity'), coverage: numeric('coverage'), method: text('method'), lot: text('lot'), notes: text('notes'), taskId: text('taskId') ? numeric('taskId') : null };
          if (payload.quantity + plan.appliedQuantity > plan.totalQuantity + 1e-7 || payload.coverage > plan.coverage) throw new Error('La aplicación supera la cantidad o cobertura aprobada.');
          if (new Date(payload.occurredAt).getTime() > Date.now()) throw new Error('La aplicación no puede estar en el futuro.');
          if (coverageUnit(plan.doseUnit) === 'plantas' && !Number.isInteger(payload.coverage)) throw new Error('Indica un número entero de plantas.');
          let application: FertilizationApplication;
          if (demo) {
            const task = app.tasks.find(item => item.id === String(plan.taskId));
            if (!task || !['pending', 'progress'].includes(task.status)) throw new Error('La tarea debe estar pendiente o en progreso.');
            const eventId = await app.create('events', { eventType: 'FERTILIZER_APPLICATION', blockId: plan.blockId, occurredAt: payload.occurredAt, notes: `Plan #${plan.id} · ${plan.product} · ${payload.quantity} ${quantityUnit(plan.doseUnit)} · ${payload.notes}` });
            const id = Date.now(); application = { ...payload, taskId: payload.taskId ?? undefined, id, planId: plan.id, eventId, createdBy: profile.user.id };
            persist({ ...records, applications: [application, ...records.applications], plans: records.plans.map(item => item.id === plan.id ? { ...item, appliedQuantity: item.appliedQuantity + payload.quantity } : item) });
            app.setTasks(previous => previous.map(item => item.id === String(plan.taskId) && item.status === 'pending' ? { ...item, status: 'progress', version: (item.version ?? 0) + 1 } : item));
          } else { application = await api.fertilizerAction<FertilizationApplication>(`plans/${plan.id}/applications`, payload); await app.refresh(true); }
          setDetail(application); setTab('applications');
        } else {
          const payload = { analysisId: text('analysisId') ? numeric('analysisId') : null, observations: text('observations') };
          if (payload.analysisId && !analyses.some(sample => sample.id === payload.analysisId && sample.blockId === plan.blockId && sample.sampledOn >= plan.scheduledOn)) throw new Error('Selecciona una muestra posterior a la fecha programada, del mismo bloque.');
          if (demo) persist({ ...records, plans: records.plans.map(item => item.id === plan.id ? { ...item, followups: [{ id: Date.now(), ...payload, reviewedBy: profile.user.id, reviewedAt: new Date().toISOString() } as unknown as FertilizationPlan['followups'][number], ...item.followups] } : item) });
          else await api.fertilizerAction(`plans/${plan.id}/followups`, payload);
        }
      }
    });
  }
  const open = (next: Editor) => { setDetail(undefined); setError(''); setEditor(next); };
  const input = (label: string, name: string, options: { type?: string; value?: string | number; required?: boolean; min?: number | string; max?: number | string; step?: string; fullWidth?: boolean } = {}) =>
    <label className={options.fullWidth ? 'full-span' : undefined}>{label}<input name={name} type={options.type ?? 'text'} defaultValue={options.value} required={options.required ?? true} min={options.min} max={options.max} step={options.step} maxLength={name === 'composition' || name === 'method' ? 1000 : 150} /></label>;
  const planSample = editor?.kind === 'plan' ? editor.sample : undefined;
  const blockSelect = <label>Bloque<select name="blockId" required defaultValue={planSample?.blockId ?? (activeBlockFilter || data.blocks[0]?.id)}>{data.blocks.map(block => <option value={block.id} key={block.id}>{block.code} · {block.field.name}{block.areaHa != null && ` · ${number(block.areaHa, 2)} ha`}</option>)}</select></label>;
  const analysisSelect = (required = true) => <label>{required ? 'Análisis de referencia' : 'Nuevo análisis de seguimiento (opcional)'}<select name="analysisId" required={required} defaultValue={planSample?.id ?? ''}><option value="">Seleccionar</option>{analyses.map(sample => <option key={sample.id} value={sample.id}>#{sample.id} · {blockLabel(sample.blockId)} · {sample.sampledOn} · {sample.reference}</option>)}</select></label>;
  const productSelect = <><label>Producto del catálogo (opcional)<select name="productId" defaultValue=""><option value="">Usar producto escrito en el plan</option>{products.map(product => <option key={product.id} value={product.id}>{product.code} · {product.name} · {doseUnits[product.defaultDoseUnit]}</option>)}</select></label>{products.length > 0 && <Notice>Al seleccionar un producto, el sistema valida la unidad estándar y conserva su composición registrada.</Notice>}</>;
  const recurrenceFields = <><label>Frecuencia de aplicación<select name="recurrence" defaultValue="NONE">{Object.entries(recurrenceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{input('Fecha final de recurrencia (opcional)', 'recurrenceUntil', { type: 'date', required: false })}</>;
  const productFields = <><Notice>Registra la composición y la unidad estándar para reutilizar el producto en planes y evitar variaciones de captura.</Notice>{input('Código interno', 'code')}{input('Nombre comercial', 'name')}{input('Composición declarada (N-P-K y otros)', 'composition') }<label>Unidad estándar de dosis<select name="defaultDoseUnit">{Object.entries(doseUnits).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Notas (opcional)<textarea name="notes" maxLength={4000} /></label></>;
  const profileFields = <><Notice>Configura rangos validados por el laboratorio o agrónomo responsable. No conviertas estos rangos en una recomendación automática.</Notice>{input('Nombre del perfil', 'name')}{input('Cultivo', 'crop')}{input('Variedad (opcional)', 'variety', { required: false })}<label>Tipo de muestra<select name="sampleType"><option value="SOIL">Suelo</option><option value="FOLIAR">Foliar</option></select></label>{input('Versión', 'version', { value: 'v1' })}{input('Fuente técnica', 'source')}<p>Completa los límites de los nutrientes que este perfil soporte.</p><div className="soil-result-grid">{(Object.entries(nutrientNames) as [Nutrient, string][]).map(([code, label]) => <fieldset key={code}><legend>{label}</legend><label>Unidad<select name={`unit-${code}`} defaultValue={code === 'PH' ? 'PH' : code === 'N' || code === 'OM' ? 'PERCENT' : 'MG_KG'}>{Object.entries(units).filter(([key]) => code === 'PH' ? key === 'PH' : key !== 'PH').map(([key, unit]) => <option key={key} value={key}>{unit}</option>)}</select></label>{input('Límite inferior', `lower-${code}`, { type: 'number', min: 0, step: 'any', required: false })}{input('Límite superior', `upper-${code}`, { type: 'number', min: 0, step: 'any', required: false })}</fieldset>)}</div></>;
  const reviewFields = editor?.kind === 'review' ? <><Notice>La revisión queda registrada a nombre de {profile.user.name} y puede actualizarse con nueva evidencia.</Notice><label>Decisión<select name="decision" defaultValue={editor.analysis.review?.decision ?? 'CONFIRMED'}><option value="CONFIRMED">Confirmar interpretación</option><option value="REQUIRES_FOLLOWUP">Requiere seguimiento</option><option value="REJECTED">Rechazar interpretación</option></select></label><label>Notas técnicas<textarea name="reason" required maxLength={4000} defaultValue={editor.analysis.review?.notes ?? ''} /></label></> : null;
  const visibleAnalyses = analyses.filter(sample => selectedBlock(sample.blockId));
  const visiblePlans = plans.filter(plan => selectedBlock(plan.blockId));
  const plansById = new Map(visiblePlans.map(plan => [plan.id, plan]));
  const visibleApplications = applications
    .flatMap(application => {
      const plan = plansById.get(application.planId);
      return plan ? [{ application, plan }] : [];
    })
    .sort((first, second) => Date.parse(second.application.occurredAt) - Date.parse(first.application.occurredAt));
  const approved = visiblePlans.filter(plan => plan.status === 'APPROVED');
  const withTask = approved.filter(plan => plan.taskId);
  const canApply = (plan: FertilizationPlan) => plan.status === 'APPROVED' && plan.taskId
    && (manager || plan.assigneeId === profile.user.id) && plan.appliedQuantity < plan.totalQuantity;
  const readyToApply = withTask.filter(canApply);
  const latestApplication = visibleApplications[0];
  const isOverview = tab === 'overview';
  const recordsTab = tab === 'overview' ? 'analyses' : tab;
  const amounts = visibleApplications.reduce((total, { application, plan }) => {
    total[quantityUnit(plan.doseUnit)] += application.quantity;
    return total;
  }, { kg: 0, L: 0 });
  const appliedAmount = (['kg', 'L'] as const).filter(unit => amounts[unit] > 0)
    .map(unit => `${number(amounts[unit], 6)} ${unit}`).join(' · ');
  const readings = visibleAnalyses.reduce((totals, analysis) => {
    const interpreted = interpretAnalysis(analysis, data.blocks.find(block => block.id === analysis.blockId)?.crop);
    totals.low += interpreted.low;
    totals.high += interpreted.high;
    totals.adequate += interpreted.adequate;
    totals.unknown += interpreted.unknown;
    if (interpreted.attention) totals.samplesWithAttention++;
    return totals;
  }, { low: 0, high: 0, adequate: 0, unknown: 0, samplesWithAttention: 0 });
  const nutrientBands = [
    { name: 'Por debajo del rango', value: readings.low, tone: 'low' },
    { name: 'En rango', value: readings.adequate, tone: 'adequate' },
    { name: 'Por encima del rango', value: readings.high, tone: 'high' },
    { name: 'Sin interpretar', value: readings.unknown, tone: 'unknown' },
  ];
  const nutrientCount = nutrientBands.reduce((total, band) => total + band.value, 0);
  const draftCount = visiblePlans.filter(plan => plan.status === 'DRAFT').length;
  const applicationBlockCount = new Set(visibleApplications.map(({ plan }) => plan.blockId)).size;
  const summary = {
    analyses: [
      { label: 'Muestras registradas', value: visibleAnalyses.length, note: 'Análisis de suelo y foliares', icon: FlaskConical, tone: 'teal' },
      { label: 'Bloques muestreados', value: new Set(visibleAnalyses.map(sample => sample.blockId)).size, note: 'Con resultados de laboratorio', icon: Layers3, tone: 'blue' },
      { label: 'Muestras fuera de rango', value: readings.samplesWithAttention, note: 'Con algún resultado alto o bajo', icon: ClipboardList, tone: 'gold' },
      { label: 'Planes aprobados', value: approved.length, note: 'Con revisión técnica', icon: ClipboardCheck, tone: 'green' },
    ],
    plans: [
      { label: 'Planes en borrador', value: draftCount, note: 'Pendientes de aprobación', icon: ClipboardList, tone: 'gold' },
      { label: 'Planes aprobados', value: approved.length, note: 'Con revisión técnica', icon: ClipboardCheck, tone: 'green' },
      { label: 'Con tarea vinculada', value: withTask.length, note: 'Planes aprobados con tarea', icon: CalendarDays, tone: 'blue' },
      { label: 'Con aplicación registrada', value: new Set(visibleApplications.map(({ plan }) => plan.id)).size, note: 'Seguimiento en campo', icon: Sprout, tone: 'teal' },
    ],
    applications: [
      { label: 'Aplicaciones registradas', value: visibleApplications.length, note: 'Incluye aplicaciones parciales', icon: Sprout, tone: 'green' },
      { label: 'Cantidad aplicada', value: appliedAmount || '—', note: 'Según la unidad de cada plan', icon: PackageCheck, tone: 'gold' },
      { label: 'Bloques atendidos', value: applicationBlockCount, note: 'Con aplicación registrada', icon: Layers3, tone: 'teal' },
      { label: 'Última aplicación', value: latestApplication ? shortDate(latestApplication.application.occurredAt) : '—', note: latestApplication ? blockLabel(latestApplication.plan.blockId) : 'Pendiente de registro', icon: CalendarDays, tone: 'blue' },
    ],
  }[recordsTab];
  const hasRecords = tab === 'analyses' ? visibleAnalyses.length > 0 : tab === 'plans' ? visiblePlans.length > 0 : visibleApplications.length > 0;
  const canCreate = tab === 'analyses' || (tab === 'plans' && manager);
  const emptyText = {
    analyses: ['Aún no hay análisis en esta selección', 'Registra la muestra y sus resultados de laboratorio para consultar su interpretación.'],
    plans: ['Aún no hay planes en esta selección', 'Usa un análisis de referencia para definir el producto, la dosis y la fecha de aplicación.'],
    applications: ['Aún no hay aplicaciones en esta selección', 'Selecciona un plan aprobado con una tarea para registrar la cantidad, la cobertura y el lote aplicado.'],
  }[recordsTab];
  const activeTab = fertilizationTabs.find(item => item.id === tab) ?? fertilizationTabs[0];
  const applicationPlan = detail && 'eventId' in detail ? plans.find(plan => plan.id === detail.planId) : undefined;
  const detailBlock = detail && 'blockId' in detail ? data.blocks.find(block => block.id === detail.blockId) : undefined;
  const newAnalysis = () => { setTab('analyses'); open({ kind: 'analysis' }); };
  const beginApplication = () => {
    if (readyToApply.length === 1) open({ kind: 'application', plan: readyToApply[0] });
    else setChoosingApplication(true);
  };
  const viewRecord = (record: Analysis | FertilizationPlan | FertilizationApplication) => { setError(''); setDetail(record); };

  return <>
    <section className="fertilization-workspace" aria-label="Proceso de fertilización">
      <header className="fertilization-title">
        <div>
          <h1>Fertilización</h1>
          <p>Planifica y da seguimiento a la nutrición del cultivo. Consulta nutrientes, planes y aplicaciones por bloque.</p>
        </div>
        <div className="fertilization-heading-actions">
          {isOverview ? <>
            {manager && <button className="button secondary" type="button" disabled={loading || !analyses.length} onClick={() => open({ kind: 'plan' })}><FilePlus2 size={17} />Crear plan de fertilización</button>}
            {(manager || readyToApply.length > 0) && <button className="button" type="button" disabled={loading} onClick={beginApplication}><Plus size={18} />Registrar aplicación</button>}
          </> : <>
            {canCreate && <button className="button fertilization-primary" type="button"
              disabled={!data.blocks.length || (tab === 'plans' && !analyses.length)}
              onClick={() => open({ kind: tab === 'analyses' ? 'analysis' : 'plan' })}>
              <Plus size={17} />{tab === 'analyses' ? 'Nuevo análisis' : 'Nuevo plan'}
            </button>}
            {tab === 'applications' && (manager || readyToApply.length > 0) && <button className="button" type="button" disabled={loading} onClick={beginApplication}><Plus size={18} />Registrar aplicación</button>}
            {tab === 'plans' && <button className="button secondary" type="button" onClick={exportCsv}><Download size={16} />Exportar planes CSV</button>}
          </>}
        </div>
      </header>
      <div className="fertilization-controls">
        <div className="module-tabs" aria-label="Secciones de fertilización">
          {fertilizationTabs.map(item => (
            <button type="button" key={item.id} aria-pressed={tab === item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}>
              <item.icon size={16} />{item.label}
            </button>
          ))}
          <button type="button" onClick={onHistory}><History size={16} />Historial anterior</button>
        </div>
        <div className="fertilization-controls-actions">
          {isOverview && <button className="outline-action" type="button" disabled={!data.blocks.length} onClick={newAnalysis}><FlaskConical size={14} />Nuevo análisis</button>}
          <label>Filtrar bloque<select className="compact-select" value={activeBlockFilter} onChange={event => setBlockFilter(event.target.value)}>
            <option value="">Todos los bloques</option>{data.blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}
          </select></label>
        </div>
      </div>
      {error && !editor && !detail && <p className="form-error" role="alert">{error}</p>}
      {isOverview ? loading ? <p role="status">Cargando fertilización…</p> : <FertilizationOverview key={`${farmId}-${activeBlockFilter}`}
        data={data} demo={demo} blockFilter={activeBlockFilter} analyses={visibleAnalyses} approvedPlans={approved}
        applications={visibleApplications} amount={appliedAmount} onTab={setTab} onAnalysis={viewRecord} onApplication={viewRecord}
        onPlan={manager ? sample => open({ kind: 'plan', sample }) : undefined} /> : <>
      <div className="fertilization-summary">
        {summary.map(item => <article className="module-kpi" key={item.label}>
          <span className={`module-kpi-icon ${item.tone}`}><item.icon size={22} /></span>
          <div><small>{item.label}</small><strong>{loading ? '—' : item.value}</strong><span>{item.note}</span></div>
        </article>)}
      </div>
      {loading ? <p role="status">Cargando fertilización…</p> : <div className="fertilization-body">
        <Panel className="fertilization-records" title={tab === 'analyses' ? 'Análisis de suelo y foliares' : tab === 'plans' ? 'Planes y seguimiento' : 'Historial de aplicaciones'}>
          {hasRecords ? <div className="table-wrap"><table className="farm-record-table" role="table"><thead role="rowgroup"><tr role="row">{(tab === 'analyses'
            ? ['Bloque / muestra', 'Fecha / laboratorio', 'Resultados', 'Interpretación', 'Detalle']
            : tab === 'plans' ? ['Bloque / producto', 'Estado', 'Previsto / aplicado', 'Seguimiento', 'Acciones']
              : ['Producto / bloque', 'Fecha / operador', 'Cantidad / cobertura', 'Lote / método', 'Detalle'])
            .map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody role="rowgroup">
            {tab === 'analyses' && visibleAnalyses.map(sample => <tr role="row" key={sample.id}>
              <td role="cell"><strong>{blockLabel(sample.blockId)}</strong><small>{sample.reference} · {sample.sampleType === 'SOIL' ? 'Suelo' : 'Foliar'}</small></td>
              <td role="cell" data-label="Fecha y laboratorio"><time dateTime={sample.sampledOn}>{shortDate(sample.sampledOn)}</time><small>{sample.laboratory}</small></td>
              <td role="cell" data-label="Resultados"><div className="fertilization-result-chips">{sample.results.slice(0, 4).map(result =>
                <span title={nutrientNames[result.nutrient]} key={result.nutrient}><b>{result.nutrient === 'PH' ? 'pH' : result.nutrient}</b> {result.value} {units[result.unit]}</span>
              )}</div></td>
              <td role="cell" data-label="Interpretación" className="farm-record-full"><AnalysisInterpretation analysis={sample} crop={data.blocks.find(block => block.id === sample.blockId)?.crop} /></td>
              <td role="cell"><button className="outline-action" aria-label={`Ver análisis ${sample.id}`} onClick={() => viewRecord(sample)}>Ver análisis</button></td>
            </tr>)}
            {tab === 'plans' && visiblePlans.map(plan => <tr role="row" key={plan.id}>
              <td role="cell"><strong>{plan.product}</strong><small>{blockLabel(plan.blockId)}</small></td>
              <td role="cell" data-label="Estado"><Badge tone={plan.status === 'APPROVED' ? 'green' : plan.status === 'DRAFT' ? 'gold' : 'neutral'}>{planLabels[plan.status]}</Badge></td>
              <td role="cell" data-label="Previsto / aplicado"><PlanProgress plan={plan} /><small>{shortDate(plan.scheduledOn)}</small></td>
              <td role="cell" data-label="Seguimiento"><time dateTime={plan.followUpOn}>{shortDate(plan.followUpOn)}</time><small>{plan.followups.length ? `${plan.followups.length} revisiones` : plan.followUpOn <= localDate() && plan.status === 'APPROVED' ? 'Revisión pendiente' : 'Sin revisión'}</small></td>
              <td role="cell"><div className="farm-record-actions">
                <button className="outline-action" aria-label={`Ver plan ${plan.id}`} onClick={() => viewRecord(plan)}>Ver plan</button>
                {manager && plan.status === 'DRAFT' && <button className="text-button" disabled={busy} onClick={() => open({ kind: 'approve', plan })}>Aprobar</button>}
                {manager && !plan.taskId && plan.status !== 'CANCELED' && <button className="text-button" onClick={() => open({ kind: 'cancel', plan })}>Anular</button>}
                {manager && plan.status === 'APPROVED' && !plan.taskId && <button className="text-button" disabled={busy} onClick={() => void generateTask(plan)}>Generar tarea</button>}
                {canApply(plan) && <button className="text-button" onClick={() => open({ kind: 'application', plan })}>Registrar aplicación</button>}
                {manager && plan.status === 'APPROVED' && <button className="text-button" onClick={() => open({ kind: 'followup', plan })}>Registrar seguimiento</button>}
              </div></td>
            </tr>)}
            {tab === 'applications' && visibleApplications.map(({ application, plan }) => <tr role="row" key={application.id}>
              <td role="cell"><strong>{plan.product}</strong><small>{blockLabel(plan.blockId)}</small></td>
              <td role="cell" data-label="Fecha / operador"><time dateTime={application.occurredAt}>{shortDate(application.occurredAt)} · {timeLabel(application.occurredAt)}</time><small>{memberName(application.createdBy)}</small></td>
              <td role="cell" data-label="Cantidad / cobertura"><strong>{number(application.quantity, 6)} {quantityUnit(plan.doseUnit)}</strong><small>{number(application.coverage, 6)} {coverageUnit(plan.doseUnit)}</small></td>
              <td role="cell" data-label="Lote / método">{application.lot}<small>{application.method}</small></td>
              <td role="cell"><button className="outline-action" aria-label={`Ver aplicación ${application.id}`} onClick={() => viewRecord(application)}>Ver aplicación</button></td>
            </tr>)}
          </tbody></table></div> : <div className="farm-record-empty">
            <span className="module-kpi-icon green"><activeTab.icon size={26} /></span>
            <div><h4>{emptyText[0]}</h4><p>{emptyText[1]}</p></div>
            {tab === 'applications' && <button className="button secondary" onClick={() => setTab('plans')}>Ver planes <ArrowRight size={16} /></button>}
            {tab === 'plans' && !analyses.length && <button className="button secondary" onClick={() => setTab('analyses')}>Ver análisis <ArrowRight size={16} /></button>}
          </div>}
        </Panel>
        <aside className="fertilization-insights">
          {tab === 'analyses' && <Panel className="fertilization-insight" title="Valores de laboratorio">
            <div className="fertilization-insight-total"><FlaskConical size={21} /><strong>{number(nutrientCount)}</strong><span>resultados medidos</span></div>
            {nutrientCount > 0 && <div className="nutrient-distribution" aria-hidden="true">{nutrientBands.filter(band => band.value > 0).map(band =>
              <span className={band.tone} key={band.tone} style={{ flex: band.value }} />
            )}</div>}
            <ul className="nutrient-distribution-key">{nutrientBands.map(band =>
              <li key={band.tone}><i className={band.tone} />{band.name}<strong>{number(band.value)}</strong></li>
            )}</ul>
            <p>Los rangos de referencia requieren revisión técnica.</p>
          </Panel>}
          {tab === 'plans' && <Panel className="fertilization-insight" title="Del análisis a la aplicación">
            <ul className="fertilization-plan-checklist">
              <li><FlaskConical size={17} /><span>Análisis de referencia</span><strong>{visibleAnalyses.length}</strong></li>
              <li><ClipboardCheck size={17} /><span>Planes aprobados</span><strong>{approved.length}</strong></li>
              <li><CalendarDays size={17} /><span>Con tarea vinculada</span><strong>{withTask.length}</strong></li>
            </ul>
            <p>Al vincular una tarea puedes registrar aplicaciones totales o parciales desde el plan.</p>
          </Panel>}
          {tab === 'applications' && latestApplication && <Panel className="fertilization-insight" title="Última aplicación registrada">
            <div className="fertilization-latest">
              <span className="module-kpi-icon teal"><Sprout size={20} /></span>
              <div><strong>{latestApplication.plan.product}</strong><small>{blockLabel(latestApplication.plan.blockId)} · {shortDate(latestApplication.application.occurredAt)}</small></div>
            </div>
            <dl className="fertilization-latest-detail">
              <div><dt>Cantidad</dt><dd>{number(latestApplication.application.quantity, 6)} {quantityUnit(latestApplication.plan.doseUnit)}</dd></div>
              <div><dt>Lote</dt><dd>{latestApplication.application.lot}</dd></div>
              <div><dt>Método</dt><dd>{latestApplication.application.method}</dd></div>
            </dl>
          </Panel>}
          {tab === 'applications' && (!latestApplication || readyToApply.length > 0) && <Panel className="fertilization-insight" title="Planes listos para aplicar">
            {readyToApply.length > 0 ? <ul className="fertilization-ready-list">{readyToApply.slice(0, 3).map(plan =>
              <li key={plan.id}><div><strong>{plan.product}</strong><small>{blockLabel(plan.blockId)}</small></div><button className="outline-action" onClick={() => open({ kind: 'application', plan })}>Registrar</button></li>
            )}</ul> : <p>Los planes aprobados con una tarea y saldo pendiente aparecen aquí.</p>}
            {readyToApply.length > 3 && <button className="text-button" onClick={() => setTab('plans')}>Ver todos los planes <ArrowRight size={14} /></button>}
          </Panel>}
        </aside>
      </div>}
      {agronomic && !loading && !demo && <aside className="fertilization-catalogs"><Panel title="Perfiles de referencia activos" action={<button className="button small secondary" onClick={() => open({ kind: 'profile' })}>Nuevo perfil</button>}><p className="muted">Los perfiles se aplican por finca, cultivo, variedad y tipo de muestra. La variedad vacía funciona como perfil general del cultivo.</p>{referenceProfiles.length ? <div className="stack-list">{referenceProfiles.map(item => <div className="list-card" key={item.id}><strong>{item.name}</strong><small>{item.crop}{item.variety ? ` · ${item.variety}` : ''} · {item.sampleType} · {item.version} · {item.ranges.length} rangos</small><small>{item.source}</small></div>)}</div> : <p className="muted">No hay perfiles configurados; los análisis aparecerán sin interpretar.</p>}</Panel><Panel title="Catálogo de fertilizantes" action={<button className="button small secondary" onClick={() => open({ kind: 'product' })}>Nuevo producto</button>}><p className="muted">Productos activos con composición y unidad estándar para planes repetibles.</p>{products.length ? <div className="stack-list">{products.map(product => <div className="list-card" key={product.id}><strong>{product.code} · {product.name}</strong><small>{product.composition} · {doseUnits[product.defaultDoseUnit]}</small>{product.notes && <small>{product.notes}</small>}</div>)}</div> : <p className="muted">No hay productos configurados; los planes pueden usar captura libre.</p>}</Panel></aside>}
      {tab !== 'applications' && <Notice>La cartilla ICA orienta el manejo integrado. El perfil base clasifica los resultados para que el responsable técnico confirme el diagnóstico y defina las dosis. {demo && 'Los datos iniciales son de demostración.'}</Notice>}
      </>}
    </section>
    {choosingApplication && <Modal className="farm-work-modal fertilization-modal" title="Seleccionar plan de aplicación" onClose={() => setChoosingApplication(false)}>
      {readyToApply.length ? <div className="fertilization-plan-picker">
        {readyToApply.map(plan => <button className="button secondary" type="button" key={plan.id} onClick={() => { setChoosingApplication(false); open({ kind: 'application', plan }); }}>
          <Sprout size={18} /><span><strong>{plan.product}</strong><small>{blockLabel(plan.blockId)} · {number(plan.totalQuantity - plan.appliedQuantity, 6)} {quantityUnit(plan.doseUnit)} pendientes</small></span><ArrowRight size={15} />
        </button>)}
      </div> : <div className="fertilization-plan-picker">
        <p>Los planes aprobados con tarea y cantidad pendiente están disponibles para registrar aplicaciones.</p>
        <button className="button" type="button" onClick={() => { setChoosingApplication(false); setTab('plans'); }}>Ver planes <ArrowRight size={15} /></button>
      </div>}
    </Modal>}
    {editor && <Modal className="farm-work-modal fertilization-modal" title={editorTitles[editor.kind]}
      onClose={() => { if (!busy) setEditor(undefined); }} wide={['analysis', 'profile', 'plan', 'application'].includes(editor.kind)}>
      <form onSubmit={submit} className="fertilization-form">
        <fieldset disabled={busy} className="fertilization-editor">
          {error && <p className="form-error" role="alert">{error}</p>}
          {editor.kind === 'profile' && <FormSection title="Perfil y rangos de referencia">{profileFields}</FormSection>}
          {editor.kind === 'product' && <FormSection title="Identificación del producto">{productFields}</FormSection>}
          {editor.kind === 'review' && <FormSection title="Decisión técnica">{reviewFields}</FormSection>}
          {editor.kind === 'analysis' && <>
            <FormSection title="Datos de la muestra">
              {blockSelect}
              <label>Tipo de muestra<select name="sampleType"><option value="SOIL">Suelo</option><option value="FOLIAR">Foliar</option></select></label>
              {input('Fecha de muestreo', 'sampledOn', { type: 'date', value: localDate(), max: localDate() })}
              {input('Laboratorio', 'laboratory')}
              {input('Referencia de muestra', 'reference')}
              {input('Profundidad (cm; 0 para foliar)', 'depthCm', { type: 'number', min: 0, max: 300, step: 'any', value: 20 })}
              {input('Latitud (opcional)', 'latitude', { type: 'number', min: -90, max: 90, step: 'any', required: false })}
              {input('Longitud (opcional)', 'longitude', { type: 'number', min: -180, max: 180, step: 'any', required: false })}
            </FormSection>
            <FormSection title="Resultados de laboratorio">
              <p className="muted">Completa los parámetros medidos y deja vacíos los que no se midieron.</p>
              <div className="soil-result-grid">{(Object.entries(nutrientNames) as [Nutrient, string][]).map(([code, label]) => <fieldset key={code}>
                <legend>{label}</legend>
                {input(`Valor ${code}`, `value-${code}`, { type: 'number', min: 0, max: code === 'PH' ? 14 : 1000000, step: 'any', required: false })}
                <label>Unidad {code}<select name={`unit-${code}`} defaultValue={code === 'PH' ? 'PH' : code === 'N' || code === 'OM' ? 'PERCENT' : 'MG_KG'}>
                  {Object.entries(units).filter(([key]) => code === 'PH' ? key === 'PH' : key !== 'PH').map(([key, unit]) => <option key={key} value={key}>{unit}</option>)}
                </select></label>
                {input(`Método ${code}`, `method-${code}`, { required: false })}
              </fieldset>)}</div>
            </FormSection>
            <FormSection title="Informe y observaciones">
              <label className="full-span">Informe de laboratorio PDF (opcional; 10 MB)<input type="file" name="report" accept="application/pdf" /></label>
              <label className="full-span">Observaciones<textarea name="notes" maxLength={4000} /></label>
            </FormSection>
          </>}
          {editor.kind === 'plan' && <>
            <FormSection title="Bloque y diagnóstico">
              {blockSelect}
              {analysisSelect()}
              <label>Inspección sanitaria relacionada (opcional)<select name="inspectionId">
                <option value="">Ninguna</option>
                {inspectionOptions.map(inspection => <option key={inspection.id} value={inspection.id}>#{inspection.id} · {blockLabel(inspection.blockId)} · {inspection.problemCode}</option>)}
              </select></label>
              {input('Etapa de crecimiento', 'growthStage')}
              <label className="full-span">Diagnóstico y justificación técnica<textarea name="diagnosis" required maxLength={4000} placeholder="Interpretación de resultados, deficiencias confirmadas y otros factores evaluados" /></label>
              <label className="full-span">Objetivo agronómico<textarea name="objective" required maxLength={2000} /></label>
            </FormSection>
            <FormSection title="Producto, dosis y método">
              {productSelect}
              {input('Producto', 'product')}
              {input('Composición declarada (N-P-K y otros)', 'composition')}
              {input('Dosis definida por el técnico', 'dose', { type: 'number', min: '0.000001', max: 1000000, step: 'any' })}
              <label>Unidad de dosis<select name="doseUnit">{Object.entries(doseUnits).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
              {input('Cobertura (ha o plantas según unidad de dosis)', 'coverage', { type: 'number', min: '0.000001', max: 10000000, step: 'any' })}
              {input('Método e instrucciones de aplicación', 'method')}
              <Notice>kg/ha × ha = kg. g/planta × plantas ÷ 1000 = kg. El mismo cálculo se aplica a L/ha y mL/planta. El plan fija la cantidad máxima aprobada.</Notice>
            </FormSection>
            <FormSection title="Programación y seguimiento">
              {input('Fecha programada', 'scheduledOn', { type: 'date', value: localDate() })}
              {input('Hora programada', 'scheduledTime', { type: 'time', value: '08:00' })}
              <label>Responsable<select name="assigneeId" required>{members.map(member => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></label>
              {input('Fecha de seguimiento', 'followUpOn', { type: 'date', value: localDate() })}
              {recurrenceFields}
            </FormSection>
          </>}
          {editor.kind === 'application' && <>
            <RecordContext icon={Sprout} title={editor.plan.product} subtitle={blockLabel(editor.plan.blockId)}>
              <small>Cantidad pendiente</small>
              <strong>{number(editor.plan.totalQuantity - editor.plan.appliedQuantity, 6)} {quantityUnit(editor.plan.doseUnit)}</strong>
            </RecordContext>
            <FormSection title="Datos de la aplicación">
              {input('Fecha y hora reales', 'occurredAt', { type: 'datetime-local', value: `${localDate()}T08:00` })}
              {editor.plan.recurrence && editor.plan.recurrence !== 'NONE' && <label>Ocurrencia de aplicación<select name="taskId" required>
                <option value="">Seleccionar tarea</option>
                {(editor.plan.tasks ?? []).map(task => <option key={task.taskId} value={task.taskId}>{task.occurrenceOn} · Tarea #{task.taskId}</option>)}
              </select></label>}
              {input('Lote del producto', 'lot')}
              {input(`Cantidad aplicada (${quantityUnit(editor.plan.doseUnit)})`, 'quantity', { type: 'number', min: '0.000001', max: Number((editor.plan.totalQuantity - editor.plan.appliedQuantity).toFixed(6)), step: 'any' })}
              {input(`Cobertura real (${coverageUnit(editor.plan.doseUnit)})`, 'coverage', { type: 'number', min: '0.000001', max: editor.plan.coverage, step: 'any' })}
              {input('Método real', 'method', { value: editor.plan.method, fullWidth: true })}
              <label className="full-span">Observaciones de campo<textarea name="notes" maxLength={4000} /></label>
              <Notice>Las fotos se adjuntan después de guardar.</Notice>
            </FormSection>
          </>}
          {editor.kind === 'followup' && <FormSection title="Revisión del plan">
            {analysisSelect(false)}
            <label className="full-span">Observaciones y conclusión técnica<textarea name="observations" required maxLength={4000} placeholder="Describe la aplicación y los cambios observados en el cultivo." /></label>
          </FormSection>}
          {(editor.kind === 'approve' || editor.kind === 'cancel') && <FormSection title="Justificación">
            <Notice>Decisión registrada a nombre de {profile.user.name}. Confirma la revisión técnica del análisis, dosis, producto y método.</Notice>
            <label className="full-span">Justificación de la decisión<textarea name="reason" required maxLength={4000} /></label>
          </FormSection>}
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={() => setEditor(undefined)}>Cancelar</button>
            <button className="button" type="submit">{busy ? 'Guardando…' : editor.kind === 'profile' ? 'Guardar perfil' : editor.kind === 'product' ? 'Guardar producto' : editor.kind === 'review' ? 'Guardar revisión' : 'Guardar'}</button>
          </div>
        </fieldset>
      </form>
    </Modal>}
    {detail && !editor && <Modal className="farm-work-modal fertilization-modal" title={'results' in detail ? `Análisis #${detail.id}` : 'product' in detail ? `Plan #${detail.id}` : `Aplicación #${detail.id}`} onClose={() => { if (!photoBusy && !busy) setDetail(undefined); }} wide>
      <div className="fertilization-record-detail">
        {error && <p className="form-error" role="alert">{error}</p>}
        {'results' in detail ? <>
          <RecordContext icon={FlaskConical} title={detail.reference}
            subtitle={`${blockLabel(detail.blockId)} · ${detail.sampleType === 'SOIL' ? 'Muestra de suelo' : 'Muestra foliar'}`} />
          <Panel title="Datos de la muestra">
            <RecordDetails entries={[
              ['Fecha de muestreo', shortDate(detail.sampledOn)], ['Laboratorio', detail.laboratory],
              ['Profundidad', `${detail.depthCm} cm`], ['Autor', memberName(detail.createdBy)],
              ...(detail.latitude != null && detail.longitude != null ? [['Coordenadas', `${detail.latitude}, ${detail.longitude}`] as [string, string]] : []),
            ]} />
            {detail.notes && <RecordNotes title="Observaciones">{detail.notes}</RecordNotes>}
            {detail.hasReport ? <a className="button secondary" href={demo ? detail.reportData : `/api/v1/fertilization/analyses/${detail.id}/report`} download={`laboratorio-${detail.id}.pdf`}>
              <Download size={16} />Descargar informe PDF
            </a> : !demo && (manager || detail.createdBy === profile.user.id) && <label className="form-label">Adjuntar informe PDF
              <input type="file" accept="application/pdf" disabled={busy} onChange={event => {
                const file = event.target.files?.[0];
                if (file) void action(async () => {
                  const form = new FormData();
                  form.append('file', file);
                  await api.fertilizerAction(`analyses/${detail.id}/report`, form);
                  setDetail({ ...detail, hasReport: true });
                });
              }} />
            </label>}
          </Panel>
          <Panel title="Resultados de laboratorio">
            <div className="table-wrap"><table>
              <thead><tr><th scope="col">Parámetro</th><th scope="col">Valor</th><th scope="col">Unidad</th><th scope="col">Método</th></tr></thead>
              <tbody>{detail.results.map(result => <tr key={result.nutrient}><td>{nutrientNames[result.nutrient]}</td><td>{result.value}</td><td>{units[result.unit]}</td><td>{result.method}</td></tr>)}</tbody>
            </table></div>
          </Panel>
          <AnalysisInterpretationDetails analysis={detail} crop={detailBlock?.crop} canReview={agronomic && !demo} onReview={() => open({ kind: 'review', analysis: detail })} />
        </> : 'product' in detail ? <>
          <RecordContext icon={ClipboardList} title={detail.product}
            subtitle={[blockLabel(detail.blockId), detailBlock?.crop, detailBlock?.variety, detail.growthStage].filter(Boolean).join(' · ')}>
            <Badge tone={detail.status === 'APPROVED' ? 'green' : detail.status === 'DRAFT' ? 'gold' : 'neutral'}>{planLabels[detail.status]}</Badge>
          </RecordContext>
          <Panel title="Producto y aplicación">
            <RecordDetails entries={[
              ['Dosis prevista', `${detail.dose} ${doseUnits[detail.doseUnit]}`],
              ['Cobertura prevista', `${detail.coverage} ${coverageUnit(detail.doseUnit)}`],
              ['Cantidad programada', `${detail.totalQuantity} ${quantityUnit(detail.doseUnit)}`],
              ['Cantidad aplicada', `${detail.appliedQuantity} ${quantityUnit(detail.doseUnit)}`],
              ['Plantas estimadas del bloque', number(data.rows.filter(row => row.block.id === detail.blockId).reduce((sum, row) => sum + (row.plantsEstimated ?? 0), 0))],
            ]} />
            <RecordNotes title="Composición">{detail.composition}</RecordNotes>
            <RecordNotes title="Método">{detail.method}</RecordNotes>
          </Panel>
          <Panel title="Programación y seguimiento">
            <RecordDetails entries={[
              ['Fecha y hora programadas', `${shortDate(detail.scheduledOn)} · ${detail.scheduledTime}`],
              ['Responsable', memberName(detail.assigneeId)],
              ['Fecha de seguimiento', shortDate(detail.followUpOn)],
              ['Tarea vinculada', detail.taskId ? `#${detail.taskId}` : 'Sin generar'],
              ...(detail.recurrence && detail.recurrence !== 'NONE'
                ? [['Frecuencia', `${recurrenceLabels[detail.recurrence]} · ${detail.tasks?.length ?? 0} ocurrencias hasta ${detail.recurrenceUntil ?? '—'}`] as [string, string]] : []),
            ]} />
            {detail.followups.map(followup => <RecordNotes key={followup.id} title={`Revisión del ${shortDate(followup.reviewedAt)} · ${memberName(followup.reviewedBy)}`}>
              {followup.observations}
              {followup.analysisId && <small>Análisis de seguimiento #{followup.analysisId}</small>}
            </RecordNotes>)}
          </Panel>
          <Panel title="Diagnóstico y aprobación">
            <RecordDetails entries={[
              ['Análisis de referencia', analyses.find(sample => sample.id === detail.analysisId)?.reference ?? `#${detail.analysisId}`],
              ['Inspección vinculada', detail.inspectionId ? `#${detail.inspectionId}` : 'Sin vincular'],
              ['Autor', memberName(detail.createdBy)],
              ['Aprobación', detail.approvedBy ? [memberName(detail.approvedBy), detail.approvedAt && shortDate(detail.approvedAt)].filter(Boolean).join(' · ') : 'Pendiente'],
            ]} />
            <RecordNotes title="Diagnóstico">{detail.diagnosis}</RecordNotes>
            <RecordNotes title="Objetivo agronómico">{detail.objective}</RecordNotes>
            {detail.decisionReason && <RecordNotes title="Justificación de la decisión">{detail.decisionReason}</RecordNotes>}
          </Panel>
          <FertilizationContext plan={detail} analyses={analyses} data={data} />
        </> : <>
          <RecordContext icon={Sprout} title={applicationPlan?.product ?? `Plan #${detail.planId}`}
            subtitle={[applicationPlan && blockLabel(applicationPlan.blockId), shortDate(detail.occurredAt), timeLabel(detail.occurredAt)].filter(Boolean).join(' · ')}>
            <small>Cantidad aplicada</small>
            <strong>{number(detail.quantity, 6)} {applicationPlan && quantityUnit(applicationPlan.doseUnit)}</strong>
          </RecordContext>
          <Panel title="Datos de la aplicación">
            <RecordDetails entries={[
              ['Operador', memberName(detail.createdBy)], ['Cobertura', `${number(detail.coverage, 6)} ${applicationPlan ? coverageUnit(applicationPlan.doseUnit) : ''}`],
              ['Lote del producto', detail.lot], ['Método', detail.method],
              ['Plan de fertilización', `#${detail.planId}`],
              ...(detail.taskId ? [['Tarea vinculada', `#${detail.taskId}`] as [string, string]] : []),
            ]} />
            {detail.notes && <RecordNotes title="Observaciones de campo">{detail.notes}</RecordNotes>}
          </Panel>
          <PhotoGallery target={{ eventId: detail.eventId }} onBusyChange={setPhotoBusy} />
        </>}
      </div>
    </Modal>}
  </>;
}
