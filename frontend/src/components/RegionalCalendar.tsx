import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarDays, Check, PauseCircle, Plus } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { readCalendarsForFarm, readCalendarsDemo, saveCalendarsDemo, type CalendarRequest, type CalendarRule } from '../lib/calendar';
import { readCatalogForFarm } from '../lib/catalog';
import { Badge, Loading, Modal, Notice, Panel } from './ui';
import type { CropCatalog } from '../lib/catalog';

const monthLabels = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const months = Array.from({ length: 12 }, (_, index) => index + 1);
const days = Array.from({ length: 31 }, (_, index) => index + 1);

export default function RegionalCalendar() {
  const { mode, role, farmId, data, notify } = useApp();
  const [rules, setRules] = useState<CalendarRule[]>([]);
  const [catalog, setCatalog] = useState<CropCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [cropId, setCropId] = useState('');
  const [varietyId, setVarietyId] = useState('');
  const [perennial, setPerennial] = useState(false);
  const farm = data.farms.find(item => item.id === farmId);
  const crop = catalog.find(item => String(item.id) === cropId);
  const varieties = useMemo(() => crop?.varieties ?? [], [crop]);

  async function reload(isActive = () => true) {
    setLoading(true); setError(''); setLoadError('');
    try {
      if (mode === 'live') {
        const [savedRules, savedCatalog] = await Promise.all([api.plantingCalendars(farmId), api.cropCatalog(farmId)]);
        if (isActive()) { setRules(savedRules); setCatalog(savedCatalog); }
      } else {
        const savedCatalog = readCatalogForFarm(farmId);
        setRules(readCalendarsForFarm(farmId)); setCatalog(savedCatalog);
      }
    } catch (failure) {
      if (isActive()) {
        setRules([]); setCatalog([]);
        setLoadError(failure instanceof Error ? failure.message : 'No se pudo cargar el calendario regional.');
      }
    } finally { if (isActive()) setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    setModal(false);
    void reload(() => active);
    return () => { active = false; };
  }, [farmId, mode]);
  useEffect(() => {
    if (!catalog.length) { setCropId(''); setVarietyId(''); return; }
    setCropId(previous => catalog.some(item => String(item.id) === previous) ? previous : String(catalog[0].id));
  }, [catalog]);
  useEffect(() => {
    setVarietyId(previous => varieties.some(item => String(item.id) === previous) ? previous : varieties[0] ? String(varieties[0].id) : '');
  }, [varieties]);

  function openCreate() {
    setError(''); setPerennial(false); setModal(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('');
    const annual = !perennial;
    const payload: CalendarRequest = {
      farmId, region: String(form.get('region') || '').trim(), cropId: Number(cropId), varietyId: varietyId ? Number(varietyId) : null,
      seasonName: String(form.get('seasonName') || '').trim(),
      windowFromMonth: annual ? Number(form.get('windowFromMonth')) : undefined, windowFromDay: annual ? Number(form.get('windowFromDay')) : undefined,
      windowToMonth: annual ? Number(form.get('windowToMonth')) : undefined, windowToDay: annual ? Number(form.get('windowToDay')) : undefined,
      perennial, preparationLeadDays: Number(form.get('preparationLeadDays') || 0), notes: String(form.get('notes') || '').trim(),
    };
    try {
      if (!crop) throw new Error('Selecciona un cultivo del catálogo.');
      if (mode === 'live') await api.createPlantingCalendar(payload);
      else {
        const stored = readCalendarsDemo();
        if (stored.some(rule => rule.farmId === farmId && rule.region.toLowerCase() === payload.region.toLowerCase() && rule.cropId === payload.cropId && (rule.varietyId ?? null) === (payload.varietyId ?? null) && rule.seasonName.toLowerCase() === payload.seasonName.toLowerCase())) throw new Error('Ya existe una regla con esos datos.');
        const id = Math.max(0, ...stored.map(rule => rule.id)) + 1;
        const next: CalendarRule = { id, farmId, region: payload.region, cropId: payload.cropId, varietyId: payload.varietyId ?? undefined, crop: crop.name, variety: varieties.find(item => String(item.id) === varietyId)?.name, seasonName: payload.seasonName, windowFromMonth: payload.windowFromMonth, windowFromDay: payload.windowFromDay, windowToMonth: payload.windowToMonth, windowToDay: payload.windowToDay, perennial, preparationLeadDays: payload.preparationLeadDays, notes: payload.notes, active: true };
        if (!saveCalendarsDemo([...stored, next])) throw new Error('No se pudo guardar el calendario en el navegador.');
      }
      setModal(false); notify(mode === 'demo' ? 'Regla regional guardada en la demostración.' : 'Regla regional guardada.'); await reload();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo guardar la regla.'); }
    finally { setBusy(false); }
  }

  async function deactivate(rule: CalendarRule) {
    try {
      if (mode === 'live') await api.deactivatePlantingCalendar(rule.id);
      else {
        const stored = readCalendarsDemo().map(item => item.id === rule.id ? { ...item, active: false } : item);
        if (!saveCalendarsDemo(stored)) throw new Error('No se pudo actualizar el calendario en el navegador.');
      }
      notify('Regla regional desactivada.'); await reload();
    } catch (failure) { notify(failure instanceof Error ? failure.message : 'No se pudo desactivar la regla.', true); }
  }

  const activeRules = useMemo(() => rules.filter(rule => rule.active), [rules]);
  if (loading) return <Loading />;
  if (loadError) return <Panel title="Calendario regional de siembra" action={<button className="button secondary small" onClick={() => void reload()}>Reintentar</button>}><p className="form-error" role="alert">{loadError}</p></Panel>;
  return <>
    <Panel title="Calendario regional de siembra" action={role !== 'WORKER' && <button className="button small" disabled={!catalog.length} onClick={openCreate}><Plus size={15} />Nueva regla</button>}>
      <Notice>{farm?.region ? `La finca está en ${farm.region}. Las ventanas se aplican a ciclos que coincidan con la región, cultivo y variedad.` : 'Registra la región de la finca para recibir sugerencias automáticas de siembra.'}</Notice>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!rules.length ? <div className="empty"><span className="icon-tile green"><CalendarDays size={26} /></span><h3>Aún no hay ventanas configuradas</h3><p>Agrega una regla anual o marca el cultivo como perenne para permitir producción continua.</p></div> : <div className="stack-list">{rules.map(rule => <div className="list-card" key={rule.id}><span className="icon-tile green"><CalendarDays size={20} /></span><span><strong>{rule.seasonName}</strong><small>{rule.region} · {rule.crop}{rule.variety ? ` · ${rule.variety}` : ' · Todas las variedades'}</small></span><span className="list-card-actions"><Badge tone={rule.active ? 'green' : 'neutral'}>{rule.active ? 'Activa' : 'Inactiva'}</Badge>{rule.active && role !== 'WORKER' && <button className="button secondary small" onClick={() => void deactivate(rule)}><PauseCircle size={14} />Desactivar</button>}</span><div className="catalog-varieties"><Badge tone="blue">{rule.perennial ? 'Todo el año' : formatWindow(rule)}</Badge><Badge tone="gold">Preparación: {rule.preparationLeadDays} días</Badge></div></div>)}</div>}
      <p className="page-note">{activeRules.length} regla{activeRules.length === 1 ? '' : 's'} activa{activeRules.length === 1 ? '' : 's'}. Las reglas de variedad específica tienen prioridad sobre las reglas generales del cultivo.</p>
    </Panel>
    {modal && <Modal title="Nueva regla regional" wide onClose={() => !busy && setModal(false)}><form className="form-grid" onSubmit={submit}><label>Región<input name="region" defaultValue={farm?.region || ''} required maxLength={200} placeholder="Ej. Zona Bananera" /></label><label>Nombre de la ventana<input name="seasonName" required maxLength={150} placeholder="Ej. Primera temporada" /></label><label>Cultivo<select value={cropId} onChange={event => setCropId(event.target.value)} required><option value="">Seleccionar cultivo</option>{catalog.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Variedad<select value={varietyId} onChange={event => setVarietyId(event.target.value)} disabled={!varieties.length}><option value="">Todas las variedades</option>{varieties.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="full-span"><span className="checkbox-label"><input type="checkbox" checked={perennial} onChange={event => setPerennial(event.target.checked)} /> Cultivo perenne o producción continua</span></label>{!perennial && <><label>Desde — mes<select name="windowFromMonth" required><option value="">Mes</option>{months.map(value => <option key={value} value={value}>{monthLabels[value]}</option>)}</select></label><label>Desde — día<select name="windowFromDay" required><option value="">Día</option>{days.map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Hasta — mes<select name="windowToMonth" required><option value="">Mes</option>{months.map(value => <option key={value} value={value}>{monthLabels[value]}</option>)}</select></label><label>Hasta — día<select name="windowToDay" required><option value="">Día</option>{days.map(value => <option key={value} value={value}>{value}</option>)}</select></label></>}<label>Preparación previa (días)<input name="preparationLeadDays" type="number" min="0" max="365" defaultValue="30" required /></label><label className="full-span">Notas<textarea name="notes" rows={3} maxLength={4000} /></label>{error && <p className="form-error full-span" role="alert">{error}</p>}<div className="form-actions full-span"><button type="button" className="button secondary" disabled={busy} onClick={() => setModal(false)}>Cancelar</button><button className="button" disabled={busy || !cropId}><Check size={16} />{busy ? 'Guardando…' : 'Guardar regla'}</button></div></form></Modal>}
  </>;
}

function formatWindow(rule: CalendarRule) {
  return `${monthLabels[rule.windowFromMonth ?? 0]} ${rule.windowFromDay} — ${monthLabels[rule.windowToMonth ?? 0]} ${rule.windowToDay}`;
}
