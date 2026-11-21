import { useEffect, useState } from 'react';
import { moistureCondition, moistureLabels, moistureUnits, withIrrigation } from '../lib/irrigation';
import type { AnalyticsLayer, FarmData } from '../lib/types';
import FarmMap from './FarmMap';
import { Notice, Panel } from './ui';

export default function MoistureMapPanel({ data, analytics, demo, selected, setSelected }: { data: FarmData; analytics?: AnalyticsLayer; demo: boolean; selected: number; setSelected: (id: number) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const sectors = analytics?.features.flatMap(feature => feature.properties.irrigationSectors ?? []).map(sector => ({ ...sector, condition: moistureCondition(sector, sector.latest, now) })) ?? [];
  const visible = analytics ? withIrrigation(analytics, sectors) : undefined;
  return <><Notice>Los límites dependen del sector, unidad y profundidad configurados por el técnico. «Dentro del rango» no significa óptimo universal. Sin configuración o con una lectura antigua no se afirma una condición actual. Bloques con varios sectores no se promedian. {demo && 'Configuración y datos ficticios.'}</Notice><Panel><FarmMap large farm={data.farms[0]} fields={data.fields} blocks={data.blocks} rows={data.rows} analytics={visible} layer="moisture" demo={demo} selected={selected} onSelect={setSelected} baseLayer="satellite" /></Panel><Panel title="Humedad por sector y trazabilidad"><div className="table-wrap"><table><thead><tr><th>Bloque / sector</th><th>Medición / unidad</th><th>Profundidad / origen</th><th>Fecha / vigencia</th><th>Rango configurado</th><th>Estado</th></tr></thead><tbody>{data.blocks.flatMap(block => {
    const matches = sectors.filter(sector => sector.blockId === block.id);
    return matches.length ? matches.map(sector => <tr key={sector.id}><td><button className="text-button" onClick={() => setSelected(block.id)}>{block.code} · {sector.name}</button></td><td>{sector.latest?.value ?? 'Sin dato'} {moistureUnits[sector.unit]}</td><td>{sector.depthCm} cm · {sector.latest?.source === 'SENSOR' ? 'Sensor' : sector.latest ? 'Manual' : 'Sin lectura'}</td><td>{sector.latest ? new Date(sector.latest.recordedAt).toLocaleString('es-CO') : 'Sin fecha'} · {sector.maxAgeHours} h</td><td>{sector.lowerBound != null ? `${sector.lowerBound}–${sector.upperBound} ${moistureUnits[sector.unit]}` : 'Sin límites técnicos'}</td><td>{moistureLabels[sector.condition]}</td></tr>) : [<tr key={`block-${block.id}`}><td>{block.code}</td><td colSpan={5}>Sin sector configurado; no se clasifican datos antiguos sin unidad.</td></tr>];
  })}</tbody></table></div></Panel></>;
}
