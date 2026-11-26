import { useEffect, useState, type FormEvent } from 'react';
import { BarChart3, Download, FileText, LayoutGrid, Plus, Receipt, Wallet } from 'lucide-react';
import { useApp } from '../context';
import { number } from '../lib/domain';
import { financeApi, financeCategories, financeCategoryLabels, financeSourceLabels, financeTypeLabels, formatCop } from '../lib/costs';
import type { FinanceCategory, FinanceEntry, FinanceEntryData, FinanceEntryType, FinanceMonth } from '../lib/costs';
import { AdminHeading, AdminTable, AdminTabs, downloadCsv, Metrics } from './AdministrationUI';
import { Badge, Empty, LinkButton, Loading, Modal, Panel } from './ui';

const tabs = [
  { label: 'Resumen', icon: LayoutGrid },
  { label: 'Gastos', icon: Wallet },
  { label: 'Ingresos', icon: Receipt },
  { label: 'Rentabilidad', icon: BarChart3 },
  { label: 'Presupuesto', icon: FileText },
];

type EntryEditor = { entry: FinanceEntry } | { type: FinanceEntryType; operationId: string };

function newOperationId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function ConnectedCosts() {
  const { farmId, role } = useApp();
  if (role !== 'ADMIN') return <>
    <AdminHeading title="Costos y rentabilidad" description="Gastos, ingresos y presupuesto de la finca." />
    <Panel><Empty title="Acceso restringido" description="Los administradores de la finca pueden consultar y registrar movimientos financieros." /></Panel>
  </>;
  return <FinanceWorkspace key={farmId} />;
}

function FinanceWorkspace() {
  const { farmId, date, search, notify } = useApp();
  const [month, setMonth] = useState(date.slice(0, 7));
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState('Resumen');
  const [result, setResult] = useState<{ month: string; data?: FinanceMonth; error?: string }>();
  const [editor, setEditor] = useState<EntryEditor>();
  const [budgetOpen, setBudgetOpen] = useState(false);
  const data = result?.month === month ? result.data : undefined;
  const error = result?.month === month ? result.error : undefined;

  useEffect(() => {
    let active = true;
    void financeApi.month(farmId, month).then(data => {
      if (active) setResult({ month, data });
    }).catch(failure => {
      if (active) setResult({ month, error: failure instanceof Error ? failure.message : 'No se pudieron cargar los datos financieros.' });
    });
    return () => { active = false; };
  }, [farmId, month, revision]);

  function refresh() {
    setResult(undefined);
    setRevision(current => current + 1);
  }

  function afterEntry(entry: FinanceEntry) {
    setEditor(undefined);
    setMonth(entry.entryDate.slice(0, 7));
    if (tab === 'Ingresos' || tab === 'Gastos') setTab(entry.type === 'INCOME' ? 'Ingresos' : 'Gastos');
    refresh();
    notify('Movimiento guardado.');
  }

  const query = search.trim().toLocaleLowerCase('es');
  const entries = (data?.entries ?? []).filter(entry => {
    const matchesType = (tab !== 'Gastos' || entry.type === 'EXPENSE') && (tab !== 'Ingresos' || entry.type === 'INCOME');
    return matchesType && [entry.description, entry.fieldName, entry.blockCode, financeCategoryLabels[entry.category], entry.sourceType && financeSourceLabels[entry.sourceType]]
      .some(value => value?.toLocaleLowerCase('es').includes(query));
  });
  const showEntries = ['Resumen', 'Gastos', 'Ingresos'].includes(tab);

  function exportEntries() {
    if (!data) return;
    downloadCsv(`movimientos-${month}.csv`, [
      ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Campo', 'Bloque', 'Valor (COP)', 'Origen', 'ID de origen'],
      ...data.entries.map(entry => [entry.entryDate, financeTypeLabels[entry.type], financeCategoryLabels[entry.category],
        entry.description, entry.fieldName ?? '', entry.blockCode ?? '', entry.amount,
        entry.sourceType ? financeSourceLabels[entry.sourceType] : '', entry.sourceId ?? '']),
    ]);
  }

  return <>
    <AdminHeading title="Costos y rentabilidad" description="Registra gastos e ingresos en pesos colombianos y consulta el margen por bloque."
      action={<button className="button" onClick={() => setEditor({ type: tab === 'Ingresos' ? 'INCOME' : 'EXPENSE', operationId: newOperationId() })}><Plus size={17} />Registrar movimiento</button>} />
    <AdminTabs tabs={tabs} value={tab} onSelect={setTab}>
      <div className="heading-buttons">
        <label className="filter-select">Mes <input aria-label="Mes" type="month" value={month} onChange={event => {
          const next = event.target.value;
          if (next && next !== month) { setResult(undefined); setMonth(next); }
        }} /></label>
        {Boolean(data?.entries.length) && <button className="button secondary" onClick={exportEntries}><Download size={16} />Exportar movimientos</button>}
      </div>
    </AdminTabs>
    {error ? <Panel><p className="form-error" role="alert">{error}</p><LinkButton onClick={refresh}>Reintentar</LinkButton></Panel>
      : !data ? <Loading /> : <>
        <Metrics items={[
          { label: 'Gastos del mes', value: formatCop(data.totals.expenses), note: 'Gastos registrados', icon: Wallet },
          { label: 'Ingresos del mes', value: formatCop(data.totals.income), note: 'Ingresos registrados', icon: Receipt },
          { label: 'Margen registrado', value: formatCop(data.totals.margin), note: 'Ingresos menos gastos', icon: BarChart3 },
          { label: 'Presupuesto mensual', value: data.budget ? formatCop(data.budget.amount) : '—', note: data.budget ? 'Monto planificado' : 'Sin presupuesto', icon: FileText },
        ]} />
        <div className="admin-lower-grid">
          {(tab === 'Resumen' || tab === 'Gastos') && <Panel title="Gastos por categoría">
            {data.expensesByCategory.length ? <AdminTable headers={['Categoría', 'Gastos (COP)']}
              rows={data.expensesByCategory.map(item => ({ key: item.category, cells: [financeCategoryLabels[item.category], formatCop(item.amount)] }))} />
              : <p className="admin-empty-copy">Sin gastos registrados para este mes.</p>}
          </Panel>}
          {(tab === 'Resumen' || tab === 'Presupuesto') && <BudgetPanel data={data} onEdit={() => setBudgetOpen(true)} />}
        </div>
        <div className="admin-main-grid" data-summary={tab === 'Resumen'}>
          {(tab === 'Resumen' || tab === 'Rentabilidad') && <Panel title="Rentabilidad por bloque">
            <p className="admin-panel-note">Calculada con los movimientos vinculados a cada bloque.</p>
            {data.blockMargins.length ? <AdminTable headers={['Bloque', 'Gastos (COP)', 'Ingresos (COP)', 'Margen (COP)']}
              rows={data.blockMargins.map(block => ({ key: block.blockId, cells: [`${block.fieldName} · ${block.blockCode}`,
                formatCop(block.expenses), formatCop(block.income), formatCop(block.margin)] }))} />
              : <p className="admin-empty-copy">Sin movimientos vinculados a bloques para este mes.</p>}
          </Panel>}
          {showEntries && <Panel title={tab === 'Resumen' ? 'Últimos movimientos' : tab}>
            {entries.length ? <AdminTable headers={['Descripción', 'Fecha', 'Tipo', 'Categoría', 'Ubicación', 'Valor (COP)']}
              rows={(tab === 'Resumen' ? entries.slice(0, 6) : entries).map(entry => ({ key: entry.id, cells: [
                entry.sourceType ? <>{entry.description}<small>{financeSourceLabels[entry.sourceType]} #{entry.sourceId}</small></>
                  : <button type="button" className="text-button" onClick={() => setEditor({ entry })} aria-label={`Editar ${entry.description}`}>{entry.description}</button>,
                entry.entryDate, financeTypeLabels[entry.type], financeCategoryLabels[entry.category], [entry.fieldName, entry.blockCode].filter(Boolean).join(' · ') || 'Sin ubicación vinculada',
                formatCop(entry.amount),
              ] }))} /> : <p className="admin-empty-copy">Sin movimientos para este mes y filtro.</p>}
          </Panel>}
        </div>
      </>}
    {editor && <EntryForm editor={editor} initialDate={date.startsWith(month) ? date : `${month}-01`} onSave={afterEntry} onClose={() => setEditor(undefined)} />}
    {budgetOpen && data && <BudgetForm month={month} amount={data.budget?.amount} onSave={() => {
      setBudgetOpen(false); refresh(); notify('Presupuesto guardado.');
    }} onClose={() => setBudgetOpen(false)} />}
  </>;
}

function BudgetPanel({ data, onEdit }: { data: FinanceMonth; onEdit: () => void }) {
  const amount = data.budget?.amount;
  const spent = data.totals.expenses;
  const percent = amount ? spent * 100 / amount : undefined;
  return <Panel title="Control presupuestal" action={<LinkButton onClick={onEdit}>{amount == null ? 'Definir presupuesto' : 'Editar presupuesto'}</LinkButton>}>
    {amount == null ? <p className="admin-empty-copy">Sin presupuesto registrado para este mes.</p> : <div className="admin-budget">
      {percent != null && <><div><strong>{number(percent, 1)}%</strong></div><progress value={Math.min(percent, 100)} max={100} aria-label="Ejecución del presupuesto" /></>}
      {spent > amount && <Badge tone="red">Presupuesto excedido</Badge>}
      <dl>
        <div><dt>Presupuestado</dt><dd>{formatCop(amount)}</dd></div>
        <div><dt>Gastado</dt><dd>{formatCop(spent)}</dd></div>
        <div><dt>Saldo del presupuesto</dt><dd>{formatCop(amount - spent)}</dd></div>
      </dl>
    </div>}
  </Panel>;
}

function EntryForm({ editor, initialDate, onSave, onClose }: { editor: EntryEditor; initialDate: string; onSave: (entry: FinanceEntry) => void; onClose: () => void }) {
  const { farmId, data } = useApp();
  const existing = 'entry' in editor ? editor.entry : undefined;
  const initialType = 'entry' in editor ? editor.entry.type : editor.type;
  const [entryDate, setEntryDate] = useState(existing?.entryDate ?? initialDate);
  const [type, setType] = useState(initialType);
  const [category, setCategory] = useState(existing?.category ?? financeCategories[initialType][0]);
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [fieldId, setFieldId] = useState(existing?.fieldId ?? 0);
  const [blockId, setBlockId] = useState(existing?.blockId ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const blocks = data.blocks.filter(block => block.field.id === fieldId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const entry: FinanceEntryData = { entryDate, type, category, amount: Number(amount), description: description.trim(), fieldId: fieldId || null, blockId: blockId || null };
    try {
      const saved = 'entry' in editor
        ? await financeApi.updateEntry(editor.entry.id, { farmId, version: editor.entry.version, entry })
        : await financeApi.createEntry({ farmId, operationId: editor.operationId, entry });
      onSave(saved);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el movimiento.');
    } finally { setBusy(false); }
  }

  return <Modal title={existing ? 'Editar movimiento' : 'Registrar movimiento'} onClose={() => { if (!busy) onClose(); }}>
    <form className="form-stack" onSubmit={submit}>
      <label>Fecha<input type="date" required value={entryDate} onChange={event => setEntryDate(event.target.value)} /></label>
      <div className="form-grid">
        <label>Tipo de movimiento<select value={type} onChange={event => {
          const next = event.target.value as FinanceEntryType;
          setType(next); setCategory(financeCategories[next][0]);
        }}>{Object.entries(financeTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Categoría<select value={category} onChange={event => setCategory(event.target.value as FinanceCategory)}>
          {financeCategories[type].map(value => <option key={value} value={value}>{financeCategoryLabels[value]}</option>)}
        </select></label>
      </div>
      <label>Valor (COP)<input type="number" min="0.01" max="999999999999.99" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <label>Descripción<input required maxLength={300} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <div className="form-grid">
        <label>Campo<select value={fieldId} onChange={event => { setFieldId(Number(event.target.value)); setBlockId(0); }}>
          <option value={0}>Sin campo</option>{data.fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}
        </select></label>
        <label>Bloque<select disabled={!blocks.length} value={blockId} onChange={event => setBlockId(Number(event.target.value))}>
          <option value={0}>Sin bloque</option>{blocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}
        </select></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="button" disabled={busy || !description.trim()}>{busy ? 'Guardando…' : 'Guardar movimiento'}</button></div>
    </form>
  </Modal>;
}

function BudgetForm({ month, amount, onSave, onClose }: { month: string; amount?: number; onSave: () => void; onClose: () => void }) {
  const { farmId } = useApp();
  const [value, setValue] = useState(amount == null ? '' : String(amount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      await financeApi.saveBudget({ farmId, month, amount: Number(value) });
      onSave();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el presupuesto.');
    } finally { setBusy(false); }
  }

  return <Modal title="Presupuesto mensual" onClose={() => { if (!busy) onClose(); }}>
    <form className="form-stack" onSubmit={submit}>
      <p className="admin-panel-note">Mes {month}</p>
      <label>Monto (COP)<input type="number" min="0" max="999999999999.99" step="0.01" required value={value} onChange={event => setValue(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancelar</button>
        <button className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar presupuesto'}</button></div>
    </form>
  </Modal>;
}
