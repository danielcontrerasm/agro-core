import { nutrientNames, units } from '../lib/fertilization';
import type { AnalyticsLayer, FarmData } from '../lib/types';
import { Notice, Panel } from './ui';
import FarmMap from './FarmMap';

export default function SoilMapPanel({ data, analytics, demo, nutrient, setNutrient, selected, setSelected }: { data: FarmData; analytics?: AnalyticsLayer; demo: boolean; nutrient: string; setNutrient: (value: string) => void; selected: number; setSelected: (id: number) => void }) {
  const code = Object.entries(nutrientNames).find(([, name]) => name === nutrient)?.[0];
  return <><Notice>Última muestra de suelo por bloque: valor, unidad, método y fecha. Los colores indican disponibilidad de datos, no deficiencia ni dosis recomendada. No se promedian muestras ni se comparan unidades o métodos diferentes. {demo && 'Valores ficticios de demostración.'}</Notice><div className="nutrient-tabs">{Object.values(nutrientNames).map(name => <button key={name} className={name === nutrient ? 'active' : ''} onClick={() => setNutrient(name)}>{name}</button>)}</div><Panel><FarmMap large fields={data.fields} blocks={data.blocks} layer="nutrients" analytics={analytics} demo={demo} nutrient={nutrient} selected={selected} onSelect={setSelected} /></Panel><Panel title={`${nutrient}: trazabilidad del muestreo`}><div className="table-wrap"><table><thead><tr><th>Bloque</th><th>Valor</th><th>Unidad</th><th>Fecha / muestra</th><th>Método / laboratorio</th></tr></thead><tbody>{data.blocks.map(block => {
    const sample = analytics?.features.find(feature => feature.properties.blockId === block.id)?.properties.soilAnalysis;
    const result = sample?.results.find(item => item.nutrient === code);
    return <tr key={block.id}><td><button className="text-button" onClick={() => setSelected(block.id)}>{block.code}</button></td><td>{result?.value ?? 'Sin dato'}</td><td>{result ? units[result.unit] : '—'}</td><td>{sample ? `${sample.sampledOn} · ${sample.reference}` : 'Sin muestra'}</td><td>{result?.method ?? '—'}<br />{sample?.laboratory}</td></tr>;
  })}</tbody></table></div></Panel></>;
}
