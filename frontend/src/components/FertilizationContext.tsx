import type { Analysis, FertilizationPlan } from '../lib/fertilization';
import { nutrientNames, units } from '../lib/fertilization';
import type { FarmData } from '../lib/types';
import { Panel } from './ui';

export default function FertilizationContext({ plan, analyses, data }: { plan: FertilizationPlan; analyses: Analysis[]; data: FarmData }) {
  const initial = analyses.find(sample => sample.id === plan.analysisId);
  const followup = plan.followups.map(review => analyses.find(sample => sample.id === review.analysisId)).find(sample => sample !== undefined);
  const events = data.events.filter(event => (event.block?.id ?? event.row?.block.id) === plan.blockId && ['HARVEST_EVENT', 'SCOUTING_OBSERVATION', 'TREATMENT_APPLICATION'].includes(event.eventType)).sort((first, second) => second.occurredAt.localeCompare(first.occurredAt)).slice(0, 5);
  return <><Panel title="Resultados y contexto del seguimiento"><p>Área del bloque: {data.blocks.find(block => block.id === plan.blockId)?.areaHa ?? 'Sin dato'} ha. No se atribuyen cambios de producción o sanidad a la fertilización automáticamente.</p>{initial && <div className="table-wrap"><table><thead><tr><th>Parámetro</th><th>Referencia {initial.sampledOn}</th><th>Seguimiento {followup?.sampledOn ?? 'Sin nueva muestra'}</th><th>Comparabilidad</th></tr></thead><tbody>{initial.results.map(result => {
    const next = followup?.results.find(item => item.nutrient === result.nutrient);
    const comparable = next && initial.sampleType === followup?.sampleType && next.unit === result.unit && next.method === result.method;
    return <tr key={result.nutrient}><td>{nutrientNames[result.nutrient]}</td><td>{result.value} {units[result.unit]}<br />{result.method}</td><td>{next ? `${next.value} ${units[next.unit]} · ${next.method}` : 'Sin dato'}</td><td>{!next ? 'Sin comparación' : comparable ? 'Misma matriz, unidad y método; requiere interpretación técnica' : 'No comparar: matriz, unidad o método diferentes'}</td></tr>;
  })}</tbody></table></div>}<p className="muted">Referencia: {initial?.reference ?? 'Sin muestra'} · Seguimiento: {followup?.reference ?? 'No vinculado'}.</p></Panel><Panel title="Contexto sanitario y de cosecha del bloque">{events.length ? events.map(event => <p key={event.id}>{new Date(event.occurredAt).toLocaleDateString('es-CO')} · {event.eventType === 'HARVEST_EVENT' ? 'Cosecha' : 'Registro sanitario'} · {event.notes || 'Sin notas'}</p>) : <p>No hay eventos sanitarios o de cosecha registrados en este bloque.</p>}</Panel></>;
}
