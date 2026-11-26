import { useEffect, useState } from 'react';
import { Plus, Leaf, Sprout, MapPin, ArrowUpRight, Trash2, Rows3, Grid2X2, LayoutList, ChevronRight, ChevronDown, Download, Wrench, Map as MapIcon, Warehouse, Layers, Eye, CalendarDays } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { readDemo } from '../lib/demo';
import { csvCell, number, farmMetrics, eventLabels } from '../lib/domain';
import { demoInspections, inspectionDemoKey, inspectionHealth, type HealthStatus } from '../lib/inspections';
import { readProductionDemo, type ProductionRecord } from '../lib/production';
import { Badge, Donut, Empty, Modal, Panel } from '../components/ui';
import { ResourceForm } from '../components/Forms';
import FieldOverviewMap, { fieldMapColors } from '../components/FieldOverviewMap';
import FarmMap from '../components/FarmMap';
import { EventIcon } from './Dashboard';
import type { Field, FieldEvent, Row } from '../lib/types';

export default function Records({ page }: { page: 'fields' | 'plants' }) {
  return page === 'fields' ? <FieldsOverview /> : <PlantsOverview />;
}

function PlantsOverview() {
  const { data, search, role, mode, remove, notify, farmId } = useApp();
  const [blockId, setBlockId] = useState(0);
  const [rowId, setRowId] = useState(0);
  const [detail, setDetail] = useState(false);
  const [limit, setLimit] = useState(25);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const manager = role !== 'WORKER';
  useEffect(() => {
    setBlockId(0);
    setRowId(0);
    setDetail(false);
    setCreating(false);
    setDeleting(false);
    setLimit(25);
  }, [farmId, mode]);
  const rows = data.rows.filter(row => (!blockId || row.block.id === blockId) &&
    `${row.rowCode} ${row.block.code} ${row.block.field.name}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  const activeRow = rows.find(row => row.id === rowId);
  const selected = activeRow ?? rows[0];
  const history = selected ? data.events.filter(event => event.row?.id === selected.id)
    .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt)) : [];
  const metrics = farmMetrics(data);
  const chooseBlock = (id: number) => {
    setBlockId(id);
    setRowId(0);
    setLimit(25);
  };

  async function confirmDelete() {
    if (!activeRow) return;
    setBusy(true);
    setError('');
    try {
      await remove('rows', activeRow.id);
      setDeleting(false);
      setDetail(false);
      setRowId(0);
      notify('Surco eliminado.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo eliminar.');
    } finally {
      setBusy(false);
    }
  }

  return <>
    <div className="page-heading">
      <div><h1>Surcos y plantas</h1><p>Consulta la ubicación, el conteo estimado de plantas y el historial de cada surco.</p></div>
      {manager && <button className="button" disabled={!data.blocks.length} onClick={() => setCreating(true)}><Plus size={17} />Nuevo surco</button>}
    </div>
    <div className="mini-stat-grid">
      <Panel><span className="icon-tile green"><Sprout size={23} /></span><div><small>Plantas estimadas</small><strong>{number(metrics.plants)}</strong></div></Panel>
      <Panel><span className="icon-tile blue"><Rows3 size={23} /></span><div><small>Surcos registrados</small><strong>{number(data.rows.length)}</strong></div></Panel>
      <Panel><span className="icon-tile gold"><Grid2X2 size={23} /></span><div><small>Bloques</small><strong>{data.blocks.length}</strong></div></Panel>
      <Panel><span className="icon-tile green"><MapPin size={23} /></span><div><small>Área registrada</small><strong>{number(metrics.area, 1)} <em>ha</em></strong></div></Panel>
    </div>
    <div className="record-overview-grid">
      <Panel title="Ubicación de los surcos" className="record-overview-map">
        <FarmMap blocks={data.blocks} fields={data.fields} farm={data.farms[0]} rows={data.rows} demo={mode === 'demo'} selected={blockId || selected?.block.id} onSelect={chooseBlock} />
      </Panel>
      <Panel title="Detalle del surco">
        {selected ? <>
          <div className="activity-detail-intro"><span className="icon-tile green"><Rows3 size={23} /></span><div><h3>{selected.rowCode}</h3><p>{selected.block.field.name} · {selected.block.code}</p></div></div>
          <dl className="record-facts">
            <div><dt>Plantas estimadas</dt><dd>{selected.plantsEstimated == null ? 'Sin registrar' : number(selected.plantsEstimated)}</dd></div>
            <div><dt>Variedad</dt><dd>{selected.block.variety || 'Sin registrar'}</dd></div>
            <div><dt>Longitud</dt><dd>{selected.lengthM == null ? 'Sin registrar' : `${number(selected.lengthM, 1)} m`}</dd></div>
            <div><dt>Espaciado</dt><dd>{selected.plantSpacingM == null ? 'Sin registrar' : `${number(selected.plantSpacingM, 1)} m`}</dd></div>
          </dl>
          <button className="button secondary" onClick={() => { setRowId(selected.id); setDetail(true); }}><CalendarDays size={16} />Ver historial del surco</button>
        </> : <Empty title="Sin surcos en esta selección" description="Selecciona otro bloque o ajusta la búsqueda." />}
      </Panel>
    </div>
    <Panel title={<>Inventario de surcos <Badge tone="neutral">{rows.length}</Badge></>}>
      <div className="toolbar">
        <select className="standalone-select" aria-label="Filtrar surcos por bloque" value={blockId} onChange={event => chooseBlock(Number(event.target.value))}>
          <option value={0}>Todos los bloques</option>
          {data.blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}
        </select>
      </div>
      {rows.length ? <div className="table-wrap"><table className="responsive-record-table">
        <thead><tr><th>Surco</th><th>Bloque / Campo</th><th>Longitud</th><th>Espaciado</th><th>Plantas estimadas</th><th>Acciones</th></tr></thead>
        <tbody>{rows.slice(0, limit).map(row => <tr key={row.id} className={selected?.id === row.id ? 'selected-record-row' : ''}>
          <td data-label="Surco"><span className="table-title"><Rows3 size={17} />{row.rowCode}</span></td>
          <td data-label="Bloque / Campo">{row.block.code}<small className="table-subtitle">{row.block.field.name}</small></td>
          <td data-label="Longitud">{row.lengthM == null ? '—' : `${number(row.lengthM, 1)} m`}</td>
          <td data-label="Espaciado">{row.plantSpacingM == null ? '—' : `${number(row.plantSpacingM, 1)} m`}</td>
          <td data-label="Plantas estimadas">{row.plantsEstimated == null ? '—' : number(row.plantsEstimated)}</td>
          <td data-label="Acciones"><div className="inline-record-actions">
            <button className="icon-button" aria-label={`Ver surco ${row.rowCode}`} onClick={() => { setRowId(row.id); setDetail(true); }}><Eye size={18} /></button>
            {manager && <button className="icon-button danger-icon" aria-label={`Eliminar ${row.rowCode}`} onClick={() => { setRowId(row.id); setError(''); setDeleting(true); }}><Trash2 size={17} /></button>}
          </div></td>
        </tr>)}</tbody>
      </table></div> : <Empty title="Sin surcos para mostrar" description="Cambia el filtro o registra un surco en este bloque." />}
      {rows.length > limit && <div className="table-pagination"><span>Mostrando {Math.min(limit, rows.length)} de {rows.length} surcos</span><button className="button secondary small" onClick={() => setLimit(value => value + 25)}>Cargar 25 más<ChevronRight size={14} /></button></div>}
    </Panel>
    {creating && <ResourceForm resource="rows" onClose={() => setCreating(false)} />}
    {detail && activeRow && <RowHistory row={activeRow} events={history} onClose={() => setDetail(false)} />}
    {deleting && activeRow && <Modal title="Eliminar registro" onClose={() => !busy && setDeleting(false)}>
      <div className="form-stack"><p>¿Eliminar <strong>{selected.rowCode}</strong>? Esta acción es permanente.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="button secondary" disabled={busy} onClick={() => setDeleting(false)}>Cancelar</button><button className="button danger" disabled={busy} onClick={() => void confirmDelete()}><Trash2 size={16} />{busy ? 'Eliminando…' : 'Eliminar registro'}</button></div>
      </div>
    </Modal>}
  </>;
}

function RowHistory({ row, events, onClose }: { row: Row; events: FieldEvent[]; onClose: () => void }) {
  const [position, setPosition] = useState<number>();
  const plantCount = row.plantsEstimated ?? 0;
  const visibleEvents = position == null ? events : events.filter(event =>
    event.plantIndexStart != null && position >= event.plantIndexStart && position <= (event.plantIndexEnd ?? event.plantIndexStart));
  return <Modal title={`Historial de ${row.rowCode}`} onClose={onClose} wide>
    <div>
      <div className="activity-detail-intro">
        <span className="icon-tile green"><Sprout size={23} /></span>
        <div><h3>{row.block.field.name} · {row.block.code}</h3><p>{row.plantsEstimated == null ? 'Conteo sin registrar' : `${number(plantCount)} plantas estimadas`}</p></div>
      </div>
      {plantCount > 0 && <section className="activity-detail-section">
        <div className="panel-heading"><h3>Ficha por posición</h3></div>
        <form className="row-position-form" onSubmit={event => {
          event.preventDefault();
          const value = Number(new FormData(event.currentTarget).get('plantPosition'));
          if (Number.isInteger(value) && value >= 1 && value <= plantCount) setPosition(value);
        }}>
          <label className="form-label">Número de planta<input name="plantPosition" type="number" min={1} max={plantCount} step={1} placeholder={`1 a ${number(plantCount)}`} required /></label>
          <button className="button" type="submit"><Eye size={16} />Consultar</button>
          {position != null && <button className="button secondary" type="button" onClick={() => setPosition(undefined)}>Ver todo el surco</button>}
        </form>
        {position == null
          ? <p className="muted">Consulta las actividades registradas para una posición dentro del surco.</p>
          : <dl className="record-facts">
            <div><dt>Posición estimada</dt><dd>Planta {number(position)} de {number(plantCount)}</dd></div>
            <div><dt>Variedad del bloque</dt><dd>{row.block.variety || 'Sin registrar'}</dd></div>
          </dl>}
      </section>}
      <section className="activity-detail-section">
        <div className="panel-heading"><h3>{position == null ? 'Actividades del surco' : `Actividades de la planta ${number(position)}`}</h3></div>
        {visibleEvents.length ? <div className="table-wrap"><table><thead><tr><th>Actividad</th><th>Fecha</th><th>Plantas</th><th>Notas</th></tr></thead>
          <tbody>{visibleEvents.map(event => <tr key={event.id}>
            <td><span className="table-title"><EventIcon event={event} />{eventLabels[event.eventType]}</span></td>
            <td>{new Date(event.occurredAt).toLocaleDateString('es-CO')}</td>
            <td>{event.plantIndexStart == null ? 'Todo el surco' : `${event.plantIndexStart}–${event.plantIndexEnd ?? event.plantIndexStart}`}</td>
            <td className="activity-detail-note">{event.notes || '—'}</td>
          </tr>)}</tbody>
        </table></div> : <Empty title="Sin actividades para esta selección" description={position == null
          ? 'Aquí aparecerán las labores registradas con este surco como ubicación.'
          : 'Aquí aparecerán las labores cuyo rango registrado incluya esta posición.'} />}
      </section>
    </div>
  </Modal>;
}

function FieldsOverview() {
  const { data, search, role, mode, fieldContextId, remove, notify } = useApp();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selectedFieldId, setSelectedFieldId] = useState(data.fields[0]?.id ?? 0);
  const [expandedFields, setExpandedFields] = useState<Set<number>>(() => new Set(data.fields.slice(0, 1).map(field => field.id)));
  const [layersOpen, setLayersOpen] = useState(() => window.matchMedia('(min-width: 651px)').matches);
  const [blockListFieldId, setBlockListFieldId] = useState<number>();
  const [form, setForm] = useState<'fields' | 'blocks' | null>(null);
  const [deleting, setDeleting] = useState<{ id: number; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const metrics = farmMetrics(data);
  const manager = role !== 'WORKER';
  const normalizedSearch = search.toLocaleLowerCase('es');
  const visibleFields = data.fields.filter(field => {
    if (fieldContextId && field.id !== fieldContextId) return false;
    return field.name.toLocaleLowerCase('es').includes(normalizedSearch)
      || data.blocks.some(block => block.field.id === field.id && block.code.toLocaleLowerCase('es').includes(normalizedSearch))
      || data.rows.some(row => row.block.field.id === field.id && row.rowCode.toLocaleLowerCase('es').includes(normalizedSearch));
  });
  const visibleBlocks = data.blocks.filter(block => visibleFields.some(field => field.id === block.field.id));
  const blockListField = visibleFields.find(field => field.id === blockListFieldId);
  const activeField = visibleFields.find(field => field.id === selectedFieldId) ?? visibleFields[0];
  const activeBlocks = activeField ? data.blocks.filter(block => block.field.id === activeField.id) : [];
  const varieties = visibleBlocks.map(block => block.variety || block.crop).filter(Boolean);
  const mainVariety = varieties.length ? Object.entries(varieties.reduce<Record<string, number>>((counts, variety) => { counts[variety] = (counts[variety] ?? 0) + 1; return counts; }, {})).sort(([, first], [, second]) => second - first)[0][0] : 'Sin registrar';
  const fieldStats = (field: Field) => {
    const fieldBlocks = data.blocks.filter(block => block.field.id === field.id);
    const fieldRows = data.rows.filter(row => row.block.field.id === field.id);
    const plants = fieldRows.reduce((total, row) => total + (row.plantsEstimated ?? 0), 0);
    return { fieldBlocks, fieldRows, plants };
  };
  const fieldIndex = (id: number) => Math.max(0, data.fields.findIndex(field => field.id === id));
  const stats = visibleFields.map(fieldStats);
  const selectedStats = activeField ? fieldStats(activeField) : undefined;
  const areaTotal = visibleFields.reduce((total, field) => total + (field.areaHa ?? 0), 0) || visibleBlocks.reduce((total, block) => total + (block.areaHa ?? 0), 0);
  const latestEvent = (type: string) => data.events.filter(event => event.eventType === type && (event.block?.field.id === activeField?.id || event.row?.block.field.id === activeField?.id)).sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))[0];
  const eventDate = (type: string) => { const event = latestEvent(type); return event ? new Date(event.occurredAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin registrar'; };

  useEffect(() => {
    if (!visibleFields.some(field => field.id === selectedFieldId)) setSelectedFieldId(visibleFields[0]?.id ?? 0);
  }, [fieldContextId, search, data.fields, data.blocks, data.rows, selectedFieldId]);

  function selectField(id: number) {
    setSelectedFieldId(id);
    setExpandedFields(previous => { const next = new Set(previous); next.add(id); return next; });
  }

  function toggleField(id: number) {
    setSelectedFieldId(id);
    setExpandedFields(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function exportFields() {
    const rows = [['Campo', 'Área (ha)', 'Bloques', 'Surcos', 'Plantas estimadas', 'Variedad']];
    visibleFields.forEach((field, index) => { const detail = stats[index]; rows.push([field.name, String(field.areaHa ?? ''), String(detail.fieldBlocks.length), String(detail.fieldRows.length), String(detail.plants), [...new Set(detail.fieldBlocks.map(block => block.variety || block.crop))].join(' · ') || 'Sin registrar']); });
    const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'campos-agrovision.csv'; anchor.click(); URL.revokeObjectURL(url); notify('Exportación de campos descargada.');
  }

  async function confirmDelete() {
    if (!deleting) return; setBusy(true); setError('');
    try { await remove('fields', deleting.id); setDeleting(null); notify(mode === 'demo' ? 'Campo eliminado de la demostración.' : 'Campo eliminado.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo eliminar el campo.'); }
    finally { setBusy(false); }
  }

  const colorFor = (id: number) => fieldMapColors[fieldIndex(id) % fieldMapColors.length];
  const selectedFieldName = activeField?.name;
  const blockList = visibleBlocks.filter(block => block.field.id === blockListField?.id);
  const viewBlocks = (id: number) => { selectField(id); setBlockListFieldId(id); setView('list'); };

  return <div className="fields-screen">
    <header className="fields-overview-header">
      <div className="page-heading fields-heading">
        <div><h1>Campos de la Finca</h1><p>Explora campos, bloques, filas y plantas de la finca.</p></div>
        <div className="fields-heading-actions">
          <button className={'fields-view-button ' + (view === 'map' ? 'active' : '')} aria-pressed={view === 'map'} onClick={() => setView('map')}><MapIcon size={16} />Vista mapa</button>
          <button className={'fields-view-button ' + (view === 'list' ? 'active' : '')} aria-pressed={view === 'list'} onClick={() => { setBlockListFieldId(undefined); setView('list'); }}><LayoutList size={16} />Vista lista</button>
          <button className="fields-tool-button" aria-expanded={view === 'map' && layersOpen} onClick={() => { setView('map'); setLayersOpen(view === 'list' || !layersOpen); }}><Wrench size={16} />Herramientas<ChevronDown size={14} /></button>
          <button className="fields-export-button" onClick={exportFields}><Download size={16} />Exportar</button>
          {manager && <button className="button fields-new-button" onClick={() => setForm('fields')}><Plus size={16} />Nuevo campo</button>}
        </div>
      </div>
      <div className="fields-stat-grid">
        {[
          { label: 'Área total', icon: Warehouse, value: number(areaTotal, 1) + ' ha' },
          { label: 'Campos', icon: Grid2X2, value: visibleFields.length },
          { label: 'Bloques', icon: Layers, value: visibleBlocks.length },
          { label: 'Filas', icon: Rows3, value: stats.reduce((sum, field) => sum + field.fieldRows.length, 0) },
          { label: 'Plantas', icon: Sprout, value: number(stats.reduce((sum, field) => sum + field.plants, 0)) },
        ].map(stat => <Panel className="fields-stat-card" key={stat.label}>
          <span className="fields-stat-icon green"><stat.icon size={23} /></span><div><small>{stat.label}</small><strong>{stat.value}</strong></div>
        </Panel>)}
        <Panel className="fields-stat-card fields-variety-card">
          <span className="fields-variety-icon" aria-hidden="true">🍌</span><div><small>Variedad principal</small><strong>{mainVariety}</strong></div>
        </Panel>
      </div>
    </header>

    <div className="fields-content-grid">
      <div className="fields-main-column">
        {view === 'map' ? <>
          <section className="fields-map-card">
            {mode === 'demo' ? <FieldOverviewMap fields={visibleFields} fieldOrder={data.fields.map(field => field.id)} blocks={visibleBlocks} selectedFieldId={activeField?.id ?? 0}
              onSelectField={selectField} layersOpen={layersOpen} onLayersChange={setLayersOpen} /> :
              <FarmMap large demo={false} farm={data.farms[0]} fields={visibleFields} blocks={visibleBlocks} rows={data.rows} baseLayer="satellite"
                onSelectField={selectField} toolsOpen={layersOpen} onToolsChange={setLayersOpen} />}
          </section>
          <div className="fields-bottom-grid">
            <Panel title="Distribución de área por campo">
              {areaTotal > 0 && visibleFields.some(field => field.areaHa) ? <div className="fields-area-summary">
                <Donut value={number(areaTotal, 1) + ' ha'} label="Total" segments={visibleFields.map(field => field.areaHa ?? 0)} colors={visibleFields.map(field => colorFor(field.id))} />
                <div className="fields-legend-list">{visibleFields.map(field => <div key={field.id}>
                  <i style={{ background: colorFor(field.id) }} /><span>{field.name}</span><strong>{number(field.areaHa ?? 0, 1)} ha</strong>
                </div>)}</div>
              </div> : <p className="fields-data-note">Sin áreas registradas para los campos visibles.</p>}
            </Panel>
            <FieldDataPanels fields={visibleFields} />
          </div>
        </> : <Panel className="fields-list-panel">
          <div className="fields-list-heading">
            <div><h3>{blockListField ? 'Bloques de ' + blockListField.name : 'Todos los campos'}</h3><p>{blockListField ? blockList.length + ' bloques registrados' : visibleFields.length + ' campos en la vista actual'}</p></div>
            {manager && <button className="button small" onClick={() => setForm('blocks')} disabled={!data.fields.length}><Plus size={15} />Nuevo bloque</button>}
          </div>
          <div className="table-wrap">
            {blockListField ? <table>
              <thead><tr><th>Bloque</th><th>Área</th><th>Cultivo</th><th>Variedad</th><th>Filas</th></tr></thead>
              <tbody>{blockList.map(block => <tr key={block.id}><td>{block.code}</td><td>{number(block.areaHa ?? 0, 1)} ha</td><td>{block.crop}</td><td>{block.variety ?? 'Sin registrar'}</td>
                <td>{data.rows.filter(row => row.block.id === block.id).length}</td></tr>)}</tbody>
            </table> : <table>
              <thead><tr><th>Campo</th><th>Área</th><th>Bloques</th><th>Filas</th><th>Plantas estimadas</th><th>Variedad</th><th>Acciones</th></tr></thead>
              <tbody>{visibleFields.map((field, index) => {
                const detail = stats[index];
                return <tr key={field.id}>
                  <td><button className="fields-table-name" onClick={() => { selectField(field.id); setView('map'); }}><span className="fields-table-dot" style={{ background: colorFor(field.id) }} />{field.name}</button></td>
                  <td>{number(field.areaHa ?? 0, 1)} ha</td><td>{detail.fieldBlocks.length}</td><td>{detail.fieldRows.length}</td><td>{number(detail.plants)}</td>
                  <td>{[...new Set(detail.fieldBlocks.map(block => block.variety || block.crop))].join(', ') || 'Sin registrar'}</td>
                  <td>{manager && <button className="icon-button danger-icon" aria-label={'Eliminar ' + field.name} onClick={() => setDeleting({ id: field.id, label: field.name })}><Trash2 size={16} /></button>}</td>
                </tr>;
              })}</tbody>
            </table>}
            {!visibleFields.length && <Empty title="No hay campos en la selección" description="Ajusta la búsqueda o registra un campo para organizar tu finca." />}
          </div>
        </Panel>}
      </div>
      <aside className="fields-side-column">
        <Panel title="Estructura de la finca" action={manager ? <button className="icon-button" aria-label="Nuevo bloque" onClick={() => setForm('blocks')} disabled={!data.fields.length}><Plus size={17} /></button> : undefined}>
          <div className="fields-tree">
            <div className="fields-tree-row fields-tree-farm"><ChevronDown size={14} /><span className="fields-tree-icon farm"><Grid2X2 size={15} /></span><span>{data.farms[0]?.name ?? 'Sin finca'}</span><strong>({number(metrics.area, 1)} ha)</strong></div>
            {visibleFields.map((field, index) => {
              const detail = stats[index];
              const expanded = expandedFields.has(field.id);
              return <div key={field.id} className="fields-tree-group">
                <button className={'fields-tree-row fields-tree-field ' + (activeField?.id === field.id ? 'active' : '')} type="button" aria-expanded={expanded} onClick={() => toggleField(field.id)}>
                  <span className="fields-tree-chevron">{expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</span>
                  <span className="fields-tree-icon" style={{ color: colorFor(field.id) }}><Warehouse size={15} /></span><span>{field.name}</span><strong>({number(field.areaHa ?? 0, 1)} ha)</strong>
                </button>
                {expanded && <div className="fields-tree-children">{detail.fieldBlocks.map(block => <button className="fields-tree-row fields-tree-block" type="button" key={block.id} onClick={() => viewBlocks(field.id)}>
                  <ChevronRight size={12} /><span className="fields-tree-icon block"><Layers size={14} /></span><span>{block.code}</span><strong>({number(block.areaHa ?? 0, 1)} ha)</strong>
                </button>)}</div>}
              </div>;
            })}
          </div>
        </Panel>
        <Panel title="Detalle del campo">
          {activeField && selectedStats ? <>
            <div className="fields-detail-heading"><span className="fields-detail-icon"><Warehouse size={24} /></span><div><h3>{selectedFieldName}</h3><span>{number(activeField.areaHa ?? 0, 1)} ha</span></div></div>
            <dl className="fields-detail-list">
              <div><dt>Variedad</dt><dd>{[...new Set(activeBlocks.map(block => block.variety || block.crop))].join(', ') || 'Sin registrar'}</dd></div>
              <div><dt>Bloques</dt><dd>{selectedStats.fieldBlocks.length}</dd></div>
              <div><dt>Filas</dt><dd>{selectedStats.fieldRows.length}</dd></div>
              <div><dt>Plantas estimadas</dt><dd>{number(selectedStats.plants)}</dd></div>
              <div><dt>Última fertilización</dt><dd>{eventDate('FERTILIZER_APPLICATION')}</dd></div>
              <div><dt>Último riego</dt><dd>{eventDate('IRRIGATION_EVENT')}</dd></div>
            </dl>
            <button className="fields-details-button" onClick={() => viewBlocks(activeField.id)}>Ver bloques del campo<ArrowUpRight size={15} /></button>
          </> : <Empty title="Selecciona un campo" description="Elige un campo en el mapa o en la estructura de la finca." />}
        </Panel>
      </aside>
    </div>
    {form && <ResourceForm resource={form} onClose={() => setForm(null)} />}
    {deleting && <Modal title="Eliminar campo" onClose={() => !busy && setDeleting(null)}><div className="form-stack"><p>¿Eliminar <strong>{deleting.label}</strong>? Esta acción es permanente y puede afectar sus bloques y registros dependientes.</p>{error && <p className="form-error" role="alert">{error}</p>}<div className="form-actions"><button className="button secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancelar</button><button className="button danger" disabled={busy} onClick={() => void confirmDelete()}><Trash2 size={16} />{busy ? 'Eliminando…' : 'Eliminar campo'}</button></div></div></Modal>}
  </div>;
}

function FieldDataPanels({ fields }: { fields: Field[] }) {
  const { data, mode, farmId } = useApp();
  const [health, setHealth] = useState<Map<number, HealthStatus | undefined> | null>();
  const [production, setProduction] = useState<ProductionRecord[] | null | undefined>(() => mode === 'demo' ? readProductionDemo() : undefined);

  useEffect(() => {
    if (mode === 'demo') return;
    let active = true;
    api.analyticsMap(farmId, 'health').then(layer => {
      if (active) setHealth(new Map(layer.features.map(({ properties }) => [properties.blockId, properties.healthStatus])));
    }).catch(() => { if (active) setHealth(null); });
    api.productionRecords(farmId).then(records => { if (active) setProduction(records); })
      .catch(() => { if (active) setProduction(null); });
    return () => { active = false; };
  }, [farmId, mode]);

  const inspections = mode === 'demo' ? readDemo(inspectionDemoKey, demoInspections()) : null;
  const healthByBlock = inspections ? new Map(data.blocks.map(block => [block.id, inspectionHealth(inspections, block.id)])) : health;
  const estimates = new Map<number, Map<string, number>>();
  for (const record of production ?? []) {
    if (record.estimatedYield == null || !record.yieldUnit) continue;
    const fieldId = record.fieldId ?? data.blocks.find(block => block.id === record.blockId)?.field.id ??
      data.rows.find(row => row.id === record.rowId)?.block.field.id;
    if (fieldId == null) continue;
    const totals = estimates.get(fieldId) ?? new Map<string, number>();
    totals.set(record.yieldUnit, (totals.get(record.yieldUnit) ?? 0) + record.estimatedYield);
    estimates.set(fieldId, totals);
  }

  return <>
    <Panel title="Salud del cultivo por campo">
      {healthByBlock && fields.length ? <dl className="fields-detail-list">{fields.map(field => {
        const statuses = data.blocks.filter(block => block.field.id === field.id).map(block => healthByBlock.get(block.id));
        const assessed = statuses.filter(status => status === 'ACTIVE_FINDINGS' || status === 'NO_ACTIVE_FINDINGS').length;
        const findings = statuses.filter(status => status === 'ACTIVE_FINDINGS').length;
        return <div key={field.id}><dt>{field.name}</dt><dd>{assessed ? `${findings} con hallazgos · ${assessed}/${statuses.length} bloques evaluados` : 'Sin evaluaciones recientes'}</dd></div>;
      })}</dl> : <p className="fields-data-note">{healthByBlock === null ? 'No se pudo consultar la salud del cultivo.' : healthByBlock === undefined ? 'Consultando evaluaciones…' : 'Sin campos en la selección.'}</p>}
    </Panel>
    <Panel title="Producción estimada">
      {production && fields.length ? <dl className="fields-detail-list">{fields.map(field => {
        const totals = estimates.get(field.id);
        return <div key={field.id}><dt>{field.name}</dt><dd>{totals ? [...totals].map(([unit, quantity]) => `${number(quantity, 2)} ${unit}`).join(' · ') : 'Sin estimación registrada'}</dd></div>;
      })}</dl> : <p className="fields-data-note">{production === null ? 'No se pudo consultar la producción estimada.' : production === undefined ? 'Consultando cosechas…' : 'Sin campos en la selección.'}</p>}
    </Panel>
  </>;
}
