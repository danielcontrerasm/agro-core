import { useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, UsersRound } from 'lucide-react';
import { useApp } from '../context';
import { number } from '../lib/domain';
import type { Member } from '../lib/types';
import { attendanceLabels, workforceApi } from '../lib/workforce';
import type { Attendance, AttendanceStatus, Crew, WorkforceData } from '../lib/workforce';
import { AdminTable } from './AdministrationUI';
import { Badge, Modal, Panel } from './ui';
import '../workforce.css';

type Editor = { kind: 'crew'; crew?: Crew } | { kind: 'attendance'; userId: number; name: string; record?: Attendance };
const tones: Record<AttendanceStatus, string> = { PRESENT: 'green', ABSENT: 'red', EXCUSED: 'blue' };
const formatDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });

export default function ConnectedWorkers({ tab, data, members, onReload }: {
  tab: 'Asistencia' | 'Cuadrillas'; data: WorkforceData; members: Member[]; onReload: () => Promise<void>;
}) {
  const { farmId, date, role, profile, notify } = useApp();
  const [editor, setEditor] = useState<Editor>();
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const manager = role === 'ADMIN' || role === 'SUPERVISOR';
  const day = formatDate.format(new Date(`${date}T12:00:00`));
  const people = new Map(manager ? members.map(member => [member.userId, member.name]) : [[profile.user.id, profile.user.name]]);
  const records = new Map(data.attendance.map(record => [record.userId, record]));
  for (const record of data.attendance) {
    if (!people.has(record.userId)) people.set(record.userId, record.userName);
  }
  const crewByPerson = new Map(data.crews.flatMap(crew => crew.memberIds.map(id => [id, crew] as const)));

  function open(next: Editor) {
    setError('');
    if (next.kind === 'attendance') setStatus(next.record?.status ?? 'PRESENT');
    setEditor(next);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (editor.kind === 'crew') {
        const name = String(form.get('name')).trim();
        if (!name) throw new Error('Escribe el nombre de la cuadrilla.');
        const fields = { name, memberIds: form.getAll('memberIds').map(Number) };
        if (editor.crew) await workforceApi.updateCrew(editor.crew.id, { ...fields, version: editor.crew.version });
        else await workforceApi.createCrew({ ...fields, farmId });
      } else {
        const fields = { status, hours: status === 'PRESENT' ? Number(form.get('hours')) : 0, notes: String(form.get('notes')).trim() || null };
        if (editor.record) await workforceApi.updateAttendance(editor.record.id, { ...fields, version: editor.record.version });
        else await workforceApi.createAttendance({ ...fields, farmId, date, userId: editor.userId });
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo guardar el registro.');
      setBusy(false);
      return;
    }
    setEditor(undefined);
    try {
      await onReload();
      notify(editor.kind === 'crew' ? 'Cuadrilla guardada.' : 'Asistencia guardada.');
    } catch {
      notify('El registro se guardó. No se pudo actualizar la vista.', true);
    } finally {
      setBusy(false);
    }
  }

  return <>
    {tab === 'Cuadrillas' ? <Panel title="Cuadrillas de la finca" action={manager && <button type="button" className="button small" disabled={busy} onClick={() => open({ kind: 'crew' })}><Plus size={16} />Nueva cuadrilla</button>}>
      {data.crews.length ? <div className="admin-crew-grid">{data.crews.map(crew => <article key={crew.id} className="workforce-crew">
        <div><UsersRound size={20} /><strong>{crew.name}</strong></div>
        {manager ? <>
          {crew.memberIds.length ? <ul>{crew.memberIds.map(id => <li key={id}>{people.get(id) ?? `Usuario #${id}`}</li>)}</ul> : <p>Sin integrantes asignados.</p>}
          <button type="button" className="text-button" disabled={busy} onClick={() => open({ kind: 'crew', crew })} aria-label={`Editar ${crew.name}`}><Pencil size={14} />Editar cuadrilla</button>
        </> : <p>Mi cuadrilla</p>}
      </article>)}</div> : <p className="admin-empty-copy">{manager ? 'Aún no hay cuadrillas registradas.' : 'Aún no tienes una cuadrilla asignada.'}</p>}
    </Panel> : <Panel title={manager ? 'Asistencia del personal' : 'Mi asistencia'}>
      <p className="admin-empty-copy"><time dateTime={date}>{day}</time></p>
      {people.size ? <AdminTable headers={['Trabajador', 'Cuadrilla', 'Estado', 'Horas', 'Notas', ...(manager ? ['Acción'] : [])]}
        rows={Array.from(people, ([id, name]) => {
          const record = records.get(id);
          const action = record ? 'Editar' : 'Registrar';
          const cells = [
            name,
            crewByPerson.get(id)?.name ?? 'Sin asignar',
            record ? <Badge tone={tones[record.status]}>{attendanceLabels[record.status]}</Badge> : <Badge tone="neutral">Sin registrar</Badge>,
            record ? `${number(record.hours, 2)} h` : '—',
            record?.notes ?? '—',
            ...(manager ? [<button type="button" className="text-button" disabled={busy} aria-label={`${action} asistencia de ${name}`} onClick={() => open({ kind: 'attendance', userId: id, name, record })}>{action}</button>] : []),
          ];
          return { key: id, cells };
        })} /> : <p className="admin-empty-copy">Aún no hay personal disponible.</p>}
    </Panel>}
    {editor && manager && <Modal title={editor.kind === 'crew' ? editor.crew ? 'Editar cuadrilla' : 'Nueva cuadrilla' : editor.record ? 'Editar asistencia' : 'Registrar asistencia'} onClose={() => !busy && setEditor(undefined)}>
      <form className="form-stack" onSubmit={save}>
        {editor.kind === 'crew' ? <>
          <label>Nombre de la cuadrilla<input name="name" required maxLength={120} defaultValue={editor.crew?.name ?? ''} /></label>
          <fieldset className="workforce-members">
            <legend>Integrantes</legend>
            {members.length ? members.map(member => {
              const crew = crewByPerson.get(member.userId);
              const assignedElsewhere = !!crew && crew.id !== editor.crew?.id;
              return <label key={member.userId}><input type="checkbox" name="memberIds" value={member.userId} defaultChecked={editor.crew?.memberIds.includes(member.userId)} disabled={assignedElsewhere} /><span>{member.name}{assignedElsewhere && <small>{crew.name}</small>}</span></label>;
            }) : <p className="admin-empty-copy">Aún no hay personal disponible.</p>}
          </fieldset>
        </> : <>
          <p className="admin-empty-copy"><strong>{editor.name}</strong> · {day}</p>
          <label>Estado<select value={status} onChange={event => setStatus(event.target.value as AttendanceStatus)}>{Object.entries(attendanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {status === 'PRESENT' && <label>Horas trabajadas<input name="hours" type="number" inputMode="decimal" required min="0.01" max="24" step="0.01" defaultValue={editor.record?.status === 'PRESENT' ? editor.record.hours : ''} /></label>}
          <label>Notas<textarea name="notes" maxLength={500} rows={3} defaultValue={editor.record?.notes ?? ''} /></label>
        </>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setEditor(undefined)}>Cancelar</button><button type="submit" className="button" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button></div>
      </form>
    </Modal>}
  </>;
}
