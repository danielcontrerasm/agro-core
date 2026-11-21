import { useEffect, useState } from 'react';
import { Layers, MapPin, Leaf, Droplets, FlaskConical, ArrowRight, Wrench, Map as MapIcon, RefreshCw, ChevronDown, Maximize2 } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { farmMetrics, number } from '../lib/domain';
import { blockMoisture, blockNutrients, demoAnalytics, readDemo } from '../lib/demo';
import { demoInspections, healthLabels, inspectionDemoKey, withInspectionHealth } from '../lib/inspections';
import type { AnalyticsLayer, DiseaseLayer } from '../lib/types';
import FarmMap from '../components/FarmMap';
import type { MapLayer } from '../components/FarmMap';
import { Badge, Donut, LineChart, LinkButton, Notice, Panel } from '../components/ui';
import { EventList } from './Dashboard';
import { nutrientNames, readFertilizationDemo, units, withSoilAnalyses, interpretNutrient, nutrientStatusTones } from '../lib/fertilization';
import { moistureLabels, moistureUnits, readIrrigationDemo, withIrrigation, type MoistureUnit } from '../lib/irrigation';

type MapFeature = AnalyticsLayer['features'][number];
type MoistureReading = { value?: number; unit?: MoistureUnit; condition?: string };
type MoistureView = 'soil' | 'sensors' | 'zones' | 'history' | 'recommendations';

const layers: { id: MapLayer; label: string; icon: typeof Leaf }[] = [
  { id: 'satellite', label: 'Vista de la finca', icon: Layers },
  { id: 'health', label: 'Salud del cultivo', icon: Leaf },
  { id: 'moisture', label: 'Humedad del suelo', icon: Droplets },
  { id: 'nutrients', label: 'Nutrientes', icon: FlaskConical },
];
const nutrientCodes: Record<string, string> = Object.fromEntries(Object.entries(nutrientNames).map(([code, label]) => [label, code]));
const moistureShortUnits: Record<MoistureUnit, string> = { VWC_PERCENT: '%', GRAV_PERCENT: '%', KPA: 'kPa' };
const nutrientColors = ['#ef6b53', '#f4a449', '#edcf50', '#73b96b', '#5386f5'];
const moistureLegend = [
  ['Muy seco', '< 10%', '#ef6b53'],
  ['Seco', '10–20%', '#f4a449'],
  ['Óptimo', '20–30%', '#73b96b'],
  ['Húmedo', '30–40%', '#75b4eb'],
  ['Exceso', '> 40%', '#5386f5'],
] as const;
const healthLegend = [
  ['Saludable', '70–100%', '#4eaf5c'],
  ['Estrés leve', '50–70%', '#9dc355'],
  ['Estrés moderado', '30–50%', '#f4c335'],
  ['En riesgo', '10–30%', '#f38a2e'],
  ['Crítico', '0–10%', '#ec5145'],
] as const;
const moistureViews: { id: MoistureView; label: string }[] = [
  { id: 'soil', label: 'Humedad del suelo' },
  { id: 'sensors', label: 'Sensores' },
  { id: 'zones', label: 'Zonas de riego' },
  { id: 'history', label: 'Histórico' },
  { id: 'recommendations', label: 'Revisiones' },
];

function nutrientResult(feature: MapFeature | undefined, selectedNutrient: string) {
  return feature?.properties.soilAnalysis?.results.find(result => result.nutrient === nutrientCodes[selectedNutrient]);
}

function nutrientInterpretation(feature: MapFeature | undefined, selectedNutrient: string) {
  const result = nutrientResult(feature, selectedNutrient);
  return result ? interpretNutrient(result, feature?.properties.crop, feature?.properties.soilAnalysis?.sampleType ?? 'SOIL') : undefined;
}

function moistureReading(feature: MapFeature | undefined, fallback?: number): MoistureReading {
  const sector = feature?.properties.irrigationSectors?.find(item => item.latest) ?? feature?.properties.irrigationSectors?.[0];
  return {
    value: sector?.latest?.value ?? feature?.properties.soilMoisture ?? fallback,
    unit: sector?.latest?.unit ?? sector?.unit,
    condition: sector?.condition ?? feature?.properties.conditionStatus,
  };
}

function shortMoistureValue(reading: MoistureReading) {
  return reading.value == null ? 'Sin dato' : `${number(reading.value, 1)} ${reading.unit ? moistureShortUnits[reading.unit] : '%'}`;
}

export default function Maps() {
  const { mode, data, farmId, navigate, search } = useApp();
  const [layer, setLayer] = useState<MapLayer>('satellite');
  const [viewMode, setViewMode] = useState<'satellite' | 'hybrid' | 'map'>('satellite');
  const [toolsOpen, setToolsOpen] = useState(true);
  const [expandSignal, setExpandSignal] = useState(0);
  const [selected, setSelected] = useState(0);
  const [compare, setCompare] = useState(false);
  const [moistureView, setMoistureView] = useState<MoistureView>('soil');
  const [nutrient, setNutrient] = useState('Nitrógeno (N)');
  const [disease, setDisease] = useState<DiseaseLayer>();
  const [analytics, setAnalytics] = useState<AnalyticsLayer>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const metrics = farmMetrics(data);
  const demo = mode === 'demo';
  const currentBlock = data.blocks.find(block => block.id === selected);
  const visibleAnalytics = demo ? withIrrigation(withSoilAnalyses(withInspectionHealth(demoAnalytics, readDemo(inspectionDemoKey, demoInspections())), readFertilizationDemo().analyses), readIrrigationDemo().sectors) : analytics;
  const analyticsFeatures = visibleAnalytics?.features ?? [];
  const featureForBlock = (blockId: number) => analyticsFeatures.find(feature => feature.properties.blockId === blockId);
  const currentAnalytics = currentBlock ? featureForBlock(currentBlock.id) : undefined;
  const focusBlock = currentBlock ?? data.blocks[0];
  const focusIndex = Math.max(0, focusBlock ? data.blocks.findIndex(block => block.id === focusBlock.id) : 0);
  const focusFeature = focusBlock ? featureForBlock(focusBlock.id) : undefined;
  const moistureReadings = data.blocks.map((block, index) => moistureReading(featureForBlock(block.id), blockMoisture[index]));
  const nutrientValues = data.blocks.map((block, index) => nutrientResult(featureForBlock(block.id), nutrient)?.value ?? (demo ? blockNutrients[index] : undefined));
  const moistureUnitCounts = moistureReadings.reduce<Record<string, number>>((counts, reading) => { if (reading.value != null && reading.unit) counts[reading.unit] = (counts[reading.unit] ?? 0) + 1; return counts; }, {});
  const referenceMoistureUnit = (Object.entries(moistureUnitCounts).sort(([, first], [, second]) => second - first)[0]?.[0] as MoistureUnit | undefined) ?? 'VWC_PERCENT';
  const comparableMoistureValues = moistureReadings.filter(reading => reading.value != null && (reading.unit ?? referenceMoistureUnit) === referenceMoistureUnit).map(reading => reading.value as number);
  const moistureAverage = comparableMoistureValues.length ? comparableMoistureValues.reduce((sum, value) => sum + value, 0) / comparableMoistureValues.length : undefined;
  const nutrientNumbers = nutrientValues.filter((value): value is number => value != null && Number.isFinite(value));
  const nutrientMin = nutrientNumbers.length ? Math.min(...nutrientNumbers) : undefined;
  const nutrientMax = nutrientNumbers.length ? Math.max(...nutrientNumbers) : undefined;
  const nutrientAverage = nutrientNumbers.length ? nutrientNumbers.reduce((sum, value) => sum + value, 0) / nutrientNumbers.length : undefined;
  const focusMoisture = moistureReading(focusFeature, blockMoisture[focusIndex]);
  const focusNutrient = nutrientResult(focusFeature, nutrient);
  const focusInterpretation = nutrientInterpretation(focusFeature, nutrient);
  const comparisonLayer: MapLayer | undefined = compare && (layer === 'moisture' || layer === 'nutrients') ? layer === 'moisture' ? 'nutrients' : 'moisture' : undefined;
  const title = layer === 'moisture' ? 'Mapa de humedad del suelo' : layer === 'nutrients' ? 'Mapa de nutrientes del suelo' : layer === 'health' ? 'Salud de tu cultivo' : 'Mapa de la Finca';
  const nutrientUnit = focusNutrient?.unit ? units[focusNutrient.unit] : nutrientNumbers.length ? units[nutrientResult(analyticsFeatures[0], nutrient)?.unit ?? 'PERCENT'] : 'Sin dato';
  const filteredBlocks = data.blocks.filter(block => block.code.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))).slice(0, 5);
  const moistureSectors = analyticsFeatures.flatMap(feature => feature.properties.irrigationSectors ?? []);
  const sensorSectors = moistureSectors.filter(sector => sector.sensorDeviceId != null || sector.latest?.source === 'SENSOR');
  const configuredSectors = moistureSectors.filter(sector => sector.lowerBound != null && sector.upperBound != null);
  const belowRangeSectors = moistureSectors.filter(sector => sector.condition === 'BELOW_RANGE');
  const aboveRangeSectors = moistureSectors.filter(sector => sector.condition === 'ABOVE_RANGE');
  const barValues = layer === 'moisture' ? moistureReadings.map(reading => reading.value) : nutrientValues;
  const maxBarValue = Math.max(...barValues.filter((value): value is number => value != null), 1);

  useEffect(() => {
    setSelected(0); setError(''); setDisease(undefined); setAnalytics(undefined);
    if (!demo && farmId) {
      let active = true; setLoading(true);
      Promise.all([api.disease(farmId), api.analyticsMap(farmId)]).then(([diseaseResult, analyticsResult]) => { if (active) { setDisease(diseaseResult); setAnalytics(analyticsResult); } }).catch(failure => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
      return () => { active = false; };
    }
  }, [farmId, demo]);

  const activateLayer = (nextLayer: MapLayer) => { setLayer(nextLayer); if (nextLayer !== 'moisture' && nextLayer !== 'nutrients') setCompare(false); };
  const toggleCompare = () => { if (layer !== 'moisture' && layer !== 'nutrients') setLayer('moisture'); setCompare(value => !value); };
  const renderLegend = (activeLayer: MapLayer) => {
    const items = activeLayer === 'moisture' ? moistureLegend : activeLayer === 'health' ? healthLegend : activeLayer === 'nutrients' ? [0, 1, 2, 3, 4].map(index => {
      const value = nutrientMin == null || nutrientMax == null ? undefined : nutrientMin + (nutrientMax - nutrientMin) * index / 4;
      return [index === 0 ? 'Más bajo' : index === 4 ? 'Más alto' : 'Intermedio', value == null ? 'Sin dato' : `${number(value, 2)} ${nutrientUnit}`, nutrientColors[index]] as const;
    }) : [['Vista general', 'Límites y cobertura', '#579359']] as const;
    return <div className="legend-list map-legend-list">{items.map(([label, value, color], index) => <div key={`${label}-${index}`}><i style={{ background: color }} /><span>{label}</span><strong>{value}</strong></div>)}</div>;
  };
  const renderMoistureSummary = () => {
    const latestSector = moistureSectors.filter(sector => sector.latest).sort((first, second) => Date.parse(second.latest!.recordedAt) - Date.parse(first.latest!.recordedAt))[0];
    if (moistureView === 'sensors') return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{sensorSectors.length}<span> sensores</span></strong><Badge>Seguimiento</Badge></div><p className="muted">Sectores con sensor asignado o lectura identificada como sensor.</p><div className="map-selected-reading"><span>Lecturas disponibles</span><strong>{sensorSectors.filter(sector => sector.latest).length}</strong><small>Consulta cada sensor desde la tabla de trazabilidad.</small></div></>;
    if (moistureView === 'zones') return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{moistureSectors.length}<span> zonas</span></strong><Badge>Configuradas</Badge></div><p className="muted">Sectores hidráulicos asociados a los bloques del mapa.</p><div className="map-selected-reading"><span>Con límites técnicos</span><strong>{configuredSectors.length}</strong><small>{moistureSectors.length - configuredSectors.length} sin límites configurados.</small></div></>;
    if (moistureView === 'history') return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{moistureSectors.filter(sector => sector.latest).length}<span> lecturas</span></strong><Badge>Histórico</Badge></div><p className="muted">Última lectura registrada por sector, conservando unidad y fecha.</p><div className="map-selected-reading"><span>{latestSector?.name ?? 'Última lectura'}</span><strong>{latestSector?.latest ? `${latestSector.latest.value} ${moistureShortUnits[latestSector.latest.unit]}` : 'Sin dato'}</strong><small>{latestSector?.latest ? new Date(latestSector.latest.recordedAt).toLocaleString('es-CO') : 'No hay lecturas disponibles.'}</small></div></>;
    if (moistureView === 'recommendations') return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{belowRangeSectors.length + aboveRangeSectors.length}<span> revisiones</span></strong><Badge>Por verificar</Badge></div><p className="muted">Prioriza la revisión de lecturas fuera del rango configurado antes de ajustar un riego.</p><div className="map-selected-reading"><span>Por debajo / por encima</span><strong>{belowRangeSectors.length} / {aboveRangeSectors.length}</strong><small>La interfaz no convierte estos estados en una recomendación automática.</small></div></>;
    return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{moistureAverage == null ? '—' : number(moistureAverage, 1)}<span>{moistureAverage == null ? '' : ` ${moistureShortUnits[referenceMoistureUnit]}`}</span></strong><Badge>Valor visible</Badge></div><p className="muted">Promedio calculado con lecturas que comparten la unidad {moistureUnits[referenceMoistureUnit]}.</p><div className="map-selected-reading"><span>{focusBlock?.code ?? 'Bloque seleccionado'}</span><strong>{shortMoistureValue(focusMoisture)}</strong><small>{focusMoisture.condition ? moistureLabels[focusMoisture.condition as keyof typeof moistureLabels] ?? focusMoisture.condition : 'Sin condición registrada'}</small></div><div className="moisture-spectrum"><i /><i /><i /><i /><i /></div><div className="spectrum-labels"><span>Muy seco</span><span>Óptimo</span><span>Exceso</span></div></>;
  };

  return <>
    <div className="page-heading maps-heading"><div><h1>{demo ? title : 'Plano de la finca'}</h1><p>{demo ? 'Activa una capa para consultar sus valores por bloque o compara humedad y nutrientes sobre el mismo mapa.' : 'Campos, bloques y observaciones geográficas registrados en tu finca.'}</p></div><div className="maps-view-toolbar"><button className={viewMode === 'satellite' ? 'active' : ''} onClick={() => { setViewMode('satellite'); activateLayer('satellite'); }}><Layers size={16} />Satélite</button><button className={viewMode === 'hybrid' ? 'active' : ''} onClick={() => setViewMode('hybrid')}><Leaf size={16} />Híbrido</button><button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}><MapIcon size={16} />Mapa</button><button className="maps-tools-button" onClick={() => setToolsOpen(value => !value)}><Wrench size={16} />Herramientas<ChevronDown size={14} /></button><button className="maps-expand-button" aria-label="Ampliar mapa" onClick={() => setExpandSignal(value => value + 1)}><Maximize2 size={16} /></button></div></div>
    <div className={`map-tabs maps-layer-tabs ${layer}`}><div className="maps-layer-tab-list">{layers.map(item => <button key={item.id} type="button" className={layer === item.id ? 'active' : ''} onClick={() => activateLayer(item.id)}><item.icon size={17} />{item.label}</button>)}</div><div className="maps-layer-tab-actions"><button type="button" className={`maps-compare-button ${compare ? 'active' : ''}`} onClick={toggleCompare}><Layers size={16} />{compare ? 'Comparación activa' : 'Comparar capas'}</button><span className="map-demo-label">{demo ? 'Datos de demostración' : 'Datos del servidor'}</span></div></div>
    {layer === 'moisture' && <div className="maps-layer-subtabs">{moistureViews.map(view => <button key={view.id} className={moistureView === view.id ? 'active' : ''} type="button" onClick={() => setMoistureView(view.id)}>{view.label}</button>)}</div>}
    {layer === 'nutrients' && <div className="nutrient-tabs maps-nutrient-tabs">{Object.values(nutrientNames).map(label => <button key={label} type="button" className={nutrient === label ? 'active' : ''} onClick={() => setNutrient(label)}>{label}</button>)}</div>}
    {!demo && <Notice>El plano muestra límites, observaciones de salud y la última telemetría disponible por bloque. Las capas se actualizan al consultar el servidor.</Notice>}
    {!demo && data.fields.some(field => field.name.includes('[PRUEBA]')) && <Notice>Plano de prueba: las divisiones marcadas [PRUEBA] tienen ubicación y linderos ficticios. No representan un levantamiento de la finca.</Notice>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    {loading && <div className="notice"><RefreshCw className="spin" size={17} />Cargando observaciones geográficas…</div>}
    {layer === 'health' && <Notice>Rojo: hallazgos activos. Verde: muestra reciente sin hallazgos activos. Gris: sin evaluación reciente. La vigencia vence en la próxima visita o a los 30 días; no es un diagnóstico de todo el bloque.</Notice>}
    <div className="map-page-grid">
      <Panel className="map-stage"><FarmMap large farm={data.farms[0]} fields={data.fields} blocks={data.blocks} rows={data.rows} layer={layer} comparisonLayer={comparisonLayer} nutrient={nutrient} selected={selected} onSelect={setSelected} onLayerChange={activateLayer} toolsOpen={toolsOpen} onToolsChange={setToolsOpen} expandSignal={expandSignal} demo={demo} disease={disease} analytics={visibleAnalytics} baseLayer={viewMode} /></Panel>
      <aside className="map-info">
        <Panel title={compare ? 'Capas activas' : layer === 'moisture' ? 'Humedad del suelo' : layer === 'nutrients' ? nutrient : demo ? 'Información de la finca' : currentBlock?.code ?? 'Información de la finca'}>
          {compare ? <div className="map-compare-metrics"><div className="map-compare-metric"><span className="stat-icon blue"><Droplets size={21} /></span><div><span>Humedad del suelo</span><strong>{moistureAverage == null ? 'Sin dato' : `${number(moistureAverage, 1)} ${moistureShortUnits[referenceMoistureUnit]}`}</strong><small>{moistureUnits[referenceMoistureUnit]}</small></div></div><div className="map-compare-metric"><span className="stat-icon green"><FlaskConical size={21} /></span><div><span>{nutrient}</span><strong>{nutrientAverage == null ? 'Sin dato' : `${number(nutrientAverage, 2)} ${nutrientUnit}`}</strong><small>Promedio de muestras</small></div></div></div> : layer === 'moisture' ? <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{moistureAverage == null ? '—' : number(moistureAverage, 1)}<span>{moistureAverage == null ? '' : ` ${moistureShortUnits[referenceMoistureUnit]}`}</span></strong><Badge>Valor visible</Badge></div><p className="muted">Promedio calculado con lecturas que comparten la unidad {moistureUnits[referenceMoistureUnit]}.</p><div className="map-selected-reading"><span>{focusBlock?.code ?? 'Bloque seleccionado'}</span><strong>{shortMoistureValue(focusMoisture)}</strong><small>{focusMoisture.condition ? moistureLabels[focusMoisture.condition as keyof typeof moistureLabels] ?? focusMoisture.condition : 'Sin condición registrada'}</small></div><div className="moisture-spectrum"><i /><i /><i /><i /><i /></div><div className="spectrum-labels"><span>Muy seco</span><span>Óptimo</span><span>Exceso</span></div></> : layer === 'nutrients' ? <><div className="layer-metric"><span className="stat-icon green"><FlaskConical size={27} /></span><strong>{nutrientAverage == null ? '—' : number(nutrientAverage, 2)}<span>{nutrientAverage == null ? '' : ` ${nutrientUnit}`}</span></strong><Badge>Valor visible</Badge></div><p className="muted">Promedio de las muestras de {nutrient.toLowerCase()} asociadas a los bloques.</p><div className="map-selected-reading"><span>{focusBlock?.code ?? 'Bloque seleccionado'}</span><strong>{focusNutrient ? `${number(focusNutrient.value, 2)} ${units[focusNutrient.unit]}` : 'Sin muestra'}</strong><small>{focusFeature?.properties.soilAnalysis?.sampledOn ? `Muestra del ${focusFeature.properties.soilAnalysis.sampledOn}` : 'Sin fecha de muestreo'}</small></div></> : <><div className="farm-thumbnail" /><h3 className="farm-info-name">{data.farms[0]?.name}</h3><div className="info-line"><MapPin size={16} /><span>{data.farms[0]?.region || 'Ubicación por definir'}</span></div><dl className="detail-list"><div><dt>Área {currentBlock ? 'del bloque' : 'total'}</dt><dd>{number(currentBlock?.areaHa ?? metrics.area, 1)} ha</dd></div><div><dt>Campos</dt><dd>{data.fields.length}</dd></div><div><dt>Bloques</dt><dd>{data.blocks.length}</dd></div><div><dt>Surcos</dt><dd>{data.rows.length}</dd></div><div><dt>Plantas estimadas</dt><dd>{number(metrics.plants)}</dd></div><div><dt>Variedad</dt><dd>{currentBlock?.variety ?? data.blocks[0]?.variety ?? 'Sin registrar'}</dd></div>{!demo && currentAnalytics && <><div><dt>Humedad de suelo</dt><dd>{currentAnalytics.properties.soilMoisture ?? 'Sin dato'}{currentAnalytics.properties.soilMoisture != null ? '%' : ''}</dd></div><div><dt>Condición</dt><dd>{currentAnalytics.properties.conditionStatus}</dd></div><div><dt>Evaluación sanitaria</dt><dd>{healthLabels[currentAnalytics.properties.healthStatus ?? 'NO_RECENT_INSPECTION']}</dd></div></>}</dl><button className="button full-width small" onClick={() => navigate('reports')}>Ver actividad de la finca<ArrowRight size={15} /></button></>}
        </Panel>
        {layer === 'moisture' && moistureView !== 'soil' && <Panel title={moistureViews.find(view => view.id === moistureView)?.label ?? 'Detalle de humedad'}>{renderMoistureSummary()}</Panel>}
        <Panel title={compare ? 'Leyendas de capas' : 'Leyenda'} action={<select className="maps-legend-select" value={layer} aria-label="Seleccionar leyenda" onChange={event => activateLayer(event.target.value as MapLayer)}><option value="satellite">Vista de la finca</option><option value="health">Salud del cultivo</option><option value="moisture">Humedad del suelo</option><option value="nutrients">Nutrientes</option></select>}>
          {compare && <div className="map-legend-group"><strong>Humedad del suelo</strong>{renderLegend('moisture')}</div>}
          {compare && <div className="map-legend-group"><strong>{nutrient}</strong>{renderLegend('nutrients')}</div>}
          {!compare && renderLegend(layer)}
        </Panel>
        {layer === 'health' && <Panel title="Estado de la muestra"><p>{currentBlock ? healthLabels[currentAnalytics?.properties.healthStatus ?? 'NO_RECENT_INSPECTION'] : 'Selecciona un bloque para consultar su evaluación.'}</p><button className="text-button" onClick={() => navigate('disease')}>Consultar inspecciones</button></Panel>}
        {layer === 'nutrients' && <Panel title="Interpretación del bloque seleccionado"><p>{focusInterpretation ? <><Badge tone={nutrientStatusTones[focusInterpretation.status]}>{focusInterpretation.label}</Badge> <span className="muted">{focusInterpretation.reason}</span></> : 'Sin resultado compatible para interpretar.'}</p><p className="muted">La clasificación es preliminar y requiere revisión técnica; no es una recomendación de dosis.</p></Panel>}
        {demo && <div className="map-help"><Leaf size={19} /><p>Haz clic en un bloque del mapa para consultar el valor de la capa activa.</p></div>}
        {demo && <Panel title="Mini mapa"><div className="maps-mini-map"><img src="/images/farm-aerial.png" alt="Vista general de la finca" /><span>N</span></div></Panel>}
      </aside>
    </div>
    {layer !== 'health' && (demo ? <div className="map-bottom-grid"><Panel title={layer === 'moisture' ? 'Evolución de la humedad' : layer === 'nutrients' ? `Evolución de ${nutrient}` : 'Distribución del área'} action={layer === 'satellite' ? undefined : <Badge tone="neutral">Datos de ejemplo</Badge>}>{layer === 'satellite' ? <div className="area-distribution"><Donut value={`${number(metrics.area)} ha`} label="Total" segments={data.blocks.map(block => block.areaHa ?? 0)} /><div className="legend-list">{data.blocks.slice(0, 5).map((block, index) => <div key={block.id}><i style={{ background: ['#65b55a', '#f5cb47', '#fa9648', '#ef615b', '#83b775'][index] }} /><span>{block.code}</span><strong>{block.areaHa} ha</strong></div>)}</div></div> : <LineChart variant={layer === 'moisture' ? 'moisture' : 'nutrient'} />}</Panel><Panel title={layer === 'moisture' ? 'Humedad por bloque' : layer === 'nutrients' ? `${nutrient} por bloque` : 'Índice de vegetación (NDVI)'} action={layer === 'satellite' ? <select className="maps-range-select" defaultValue="3" aria-label="Periodo del índice"><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option></select> : <Badge tone="neutral">Valores por bloque</Badge>}>{layer === 'satellite' ? <LineChart /> : <><div className="bar-list map-bar-list">{filteredBlocks.map(block => { const index = data.blocks.findIndex(item => item.id === block.id); const value = barValues[index]; const reading = layer === 'moisture' ? moistureReadings[index] : undefined; const result = layer === 'nutrients' ? nutrientResult(featureForBlock(block.id), nutrient) : undefined; return <button className={`bar-row ${selected === block.id ? 'selected-bar' : ''}`} key={block.id} onClick={() => setSelected(block.id)}><span>{block.code}</span><div><i style={{ width: `${value == null ? 0 : value / maxBarValue * 100}%`, background: nutrientColors[index % nutrientColors.length] }} /></div><strong>{value == null ? '—' : layer === 'moisture' ? shortMoistureValue(reading ?? {}) : `${number(value, 2)} ${result ? units[result.unit] : ''}`}</strong></button>; })}</div>{layer === 'nutrients' && <p className="chart-footnote">Los valores corresponden a la muestra seleccionada y no son recomendaciones automáticas de fertilización.</p>}</>}</Panel><Panel title={layer === 'satellite' ? 'Últimas actividades' : 'Actividad reciente'} action={<LinkButton onClick={() => navigate('reports')}>Ver todo</LinkButton>}><EventList limit={layer === 'satellite' ? 4 : 3} /></Panel></div> : <Panel title="Detalle de las observaciones" className="map-observations"><div className="table-wrap"><table><thead><tr><th>Surco</th><th>Severidad máxima</th><th>Observaciones</th><th>Último registro</th></tr></thead><tbody>{disease?.features.map(feature => <tr key={feature.properties.rowId}><td>{feature.properties.rowCode}</td><td>{feature.properties.maxSeverity ?? 'Sin dato'}</td><td>{feature.properties.countObservations}</td><td>{feature.properties.lastObservedAt ? new Date(feature.properties.lastObservedAt).toLocaleString('es-CO') : 'Sin fecha'}</td></tr>)}</tbody></table></div></Panel>)}
    {layer === 'moisture' && <Panel title="Humedad por sector y trazabilidad" className="map-traceability"><div className="table-wrap"><table><thead><tr><th>Bloque / sector</th><th>Medición / unidad</th><th>Profundidad / origen</th><th>Fecha / vigencia</th><th>Rango configurado</th><th>Estado</th></tr></thead><tbody>{data.blocks.flatMap(block => { const matches = moistureSectors.filter(sector => sector.blockId === block.id); return matches.length ? matches.map(sector => <tr key={sector.id}><td><button className="text-button" onClick={() => setSelected(block.id)}>{block.code} · {sector.name}</button></td><td>{sector.latest?.value ?? 'Sin dato'} {moistureUnits[sector.unit]}</td><td>{sector.depthCm} cm · {sector.latest?.source === 'SENSOR' ? 'Sensor' : sector.latest ? 'Manual' : 'Sin lectura'}</td><td>{sector.latest ? new Date(sector.latest.recordedAt).toLocaleString('es-CO') : 'Sin fecha'} · {sector.maxAgeHours} h</td><td>{sector.lowerBound != null ? `${sector.lowerBound}–${sector.upperBound} ${moistureUnits[sector.unit]}` : 'Sin límites técnicos'}</td><td>{moistureLabels[sector.condition]}</td></tr>) : [<tr key={`block-${block.id}`}><td>{block.code}</td><td colSpan={5}>Sin sector configurado; no se clasifican datos sin unidad.</td></tr>]; })}</tbody></table></div></Panel>}
    {layer === 'nutrients' && <Panel title={`${nutrient}: trazabilidad del muestreo`} className="map-traceability"><div className="table-wrap"><table><thead><tr><th>Bloque</th><th>Valor</th><th>Unidad</th><th>Fecha / muestra</th><th>Método / laboratorio</th></tr></thead><tbody>{data.blocks.map(block => { const sample = featureForBlock(block.id)?.properties.soilAnalysis; const result = nutrientResult(featureForBlock(block.id), nutrient); return <tr key={block.id}><td><button className="text-button" onClick={() => setSelected(block.id)}>{block.code}</button></td><td>{result?.value ?? 'Sin dato'}</td><td>{result ? units[result.unit] : '—'}</td><td>{sample ? `${sample.sampledOn} · ${sample.reference}` : 'Sin muestra'}</td><td>{result?.method ?? '—'}<br />{sample?.laboratory ?? 'Sin laboratorio'}</td></tr>; })}</tbody></table></div></Panel>}
    {layer === 'nutrients' && <Panel title={`${nutrient}: interpretación por bloque`} className="map-traceability"><div className="table-wrap"><table><thead><tr><th>Bloque</th><th>Estado</th><th>Fundamento</th></tr></thead><tbody>{data.blocks.map(block => { const interpretation = nutrientInterpretation(featureForBlock(block.id), nutrient); return <tr key={block.id}><td><button className="text-button" onClick={() => setSelected(block.id)}>{block.code}</button></td><td>{interpretation ? <Badge tone={nutrientStatusTones[interpretation.status]}>{interpretation.label}</Badge> : 'Sin muestra'}</td><td>{interpretation?.reason ?? 'No hay un resultado compatible.'}</td></tr>; })}</tbody></table></div><p className="muted">El estado es preliminar, depende del perfil base y requiere revisión técnica. No representa una recomendación de fertilización.</p></Panel>}
  </>;
}
