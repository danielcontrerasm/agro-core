import { useEffect, useState } from 'react';
import { Layers, MapPin, Leaf, Droplets, FlaskConical, ArrowRight, Wrench, RefreshCw, Maximize2, Radio, Sprout, TriangleAlert } from 'lucide-react';
import { useApp } from '../context';
import { api } from '../lib/api';
import { farmMetrics, localDate, number } from '../lib/domain';
import { demoAnalytics, readDemo } from '../lib/demo';
import { demoInspections, healthLabels, inspectionDemoKey, withInspectionHealth } from '../lib/inspections';
import type { AnalyticsLayer, DiseaseLayer } from '../lib/types';
import FarmMap from '../components/FarmMap';
import type { MapLayer } from '../components/FarmMap';
import { Badge, Donut, LineChart, LinkButton, Notice, Panel } from '../components/ui';
import { EventList } from './Dashboard';
import { nutrientNames, readFertilizationDemo, units, withSoilAnalyses, interpretAnalysis, nutrientStatusTones } from '../lib/fertilization';
import { moistureLabels, moistureUnits, readIrrigationDemo, withIrrigation, type MoistureUnit } from '../lib/irrigation';
import { healthMapBands, mapNutrientCodes, mapMoistureReading, moistureMapBands, moistureMapColor, moistureMapUnits, nutrientMapBand, nutrientMapColors, summarizeNutrientMap } from '../lib/map-analytics';

type MapFeature = AnalyticsLayer['features'][number];
type MoistureReading = { value?: number; unit?: MoistureUnit; sectorCount?: number };
type MoistureView = 'soil' | 'sensors' | 'zones' | 'history' | 'recommendations';

const layers: { id: MapLayer; label: string; icon: typeof Leaf }[] = [
  { id: 'satellite', label: 'Vista de la finca', icon: Layers },
  { id: 'health', label: 'Salud del cultivo', icon: Leaf },
  { id: 'moisture', label: 'Humedad del suelo', icon: Droplets },
  { id: 'nutrients', label: 'Nutrientes', icon: FlaskConical },
];
const demoHealthLegend = [
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
  { id: 'history', label: 'Últimas lecturas' },
  { id: 'recommendations', label: 'Revisiones' },
];

function nutrientResult(feature: MapFeature | undefined, selectedNutrient: string) {
  return feature?.properties.soilAnalysis?.results.find(result => result.nutrient === mapNutrientCodes[selectedNutrient]);
}

function nutrientInterpretation(feature: MapFeature | undefined, selectedNutrient: string, demo: boolean) {
  const properties = feature?.properties;
  return properties?.soilAnalysis ? interpretAnalysis(properties.soilAnalysis, properties.crop, demo).interpretations.find(item => item.nutrient === mapNutrientCodes[selectedNutrient]) : undefined;
}

function shortMoistureValue(reading: MoistureReading) {
  if (reading.sectorCount && reading.sectorCount > 1) return reading.sectorCount + ' sectores';
  return reading.value == null || !reading.unit ? 'Sin dato' : `${number(reading.value, 1)} ${moistureMapUnits[reading.unit]}`;
}

function LayerTrend({ samples, unit }: { samples: { date: string; value: number }[]; unit: string }) {
  const days = new Map<string, { sum: number; count: number }>();
  for (const sample of samples) {
    const day = days.get(sample.date) ?? { sum: 0, count: 0 };
    day.sum += sample.value;
    day.count += 1;
    days.set(sample.date, day);
  }
  const history = [...days].sort(([first], [second]) => first.localeCompare(second)).slice(-7);
  if (!history.length) return <p className="map-data-note">Sin registros comparables para la unidad seleccionada.</p>;
  const maximum = Math.max(...history.map(([, day]) => day.sum / day.count), 0.001);
  const points = history.map(([date, day], index) => {
    const value = day.sum / day.count;
    return { date, value, x: history.length === 1 ? 206 : 46 + index * 320 / (history.length - 1), y: 111 - 88 * value / maximum };
  });
  return <div className="map-trend">
    <svg role="img" aria-label={points.map(point => `${point.date}: ${number(point.value, 2)} ${unit}`).join(', ')} viewBox="0 0 410 139">
      {[1, .5, 0].map(ratio => <g key={ratio}><line x1="42" x2="382" y1={111 - 88 * ratio} y2={111 - 88 * ratio} /><text x="34" y={115 - 88 * ratio} textAnchor="end">{number(maximum * ratio, 1)}</text></g>)}
      {points.length > 1 && <>
        <polygon points={`${points[0].x},111 ${points.map(point => `${point.x},${point.y}`).join(' ')} ${points.at(-1)!.x},111`} />
        <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} />
      </>}
      {points.map(point => <g key={point.date}><circle cx={point.x} cy={point.y} r="4" /><title>{`${number(point.value, 2)} ${unit}`}</title><text x={point.x} y="131" textAnchor="middle">{new Date(`${point.date}T12:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</text></g>)}
    </svg>
    <p className="map-data-note">{history.length === 1 ? 'Una fecha de registro. ' : ''}Promedio por fecha · {unit}</p>
  </div>;
}

export default function Maps() {
  const { mode, data, farmId, mapFieldId, mapBlockId, setMapBlockId: setSelected, navigate, search } = useApp();
  const [layer, setLayer] = useState<MapLayer>('satellite');
  const [viewMode, setViewMode] = useState<'satellite' | 'hybrid' | 'map'>('satellite');
  const [toolsOpen, setToolsOpen] = useState(() => window.matchMedia('(min-width: 801px)').matches);
  const [expandSignal, setExpandSignal] = useState(0);
  const selected = data.blocks.some(block => block.id === mapBlockId) ? mapBlockId : 0;
  const [compare, setCompare] = useState(false);
  const [moistureView, setMoistureView] = useState<MoistureView>('soil');
  const [nutrient, setNutrient] = useState('Nitrógeno (N)');
  const [sources, setSources] = useState<{ farmId: number; disease?: DiseaseLayer; analytics?: AnalyticsLayer; error?: string }>();
  const metrics = farmMetrics(data);
  const demo = mode === 'demo';
  const currentSources = !demo && sources?.farmId === farmId ? sources : undefined;
  const loading = !demo && Boolean(farmId) && !currentSources;
  const currentBlock = data.blocks.find(block => block.id === selected);
  const hasArea = data.fields.some(field => field.areaHa != null) || data.blocks.some(block => block.areaHa != null);
  const area = currentBlock ? currentBlock.areaHa : hasArea ? metrics.area : undefined;
  const hasPlantEstimates = data.rows.some(row => row.plantsEstimated != null);
  const demoIrrigation = demo ? readIrrigationDemo() : undefined;
  const demoFertilization = demo ? readFertilizationDemo() : undefined;
  const visibleAnalytics = demoIrrigation && demoFertilization ? withIrrigation(withSoilAnalyses(withInspectionHealth(demoAnalytics, readDemo(inspectionDemoKey, demoInspections())), demoFertilization.analyses), demoIrrigation.sectors) : currentSources?.analytics;
  const analyticsFeatures = visibleAnalytics?.features ?? [];
  const featureForBlock = (blockId: number) => analyticsFeatures.find(feature => feature.properties.blockId === blockId);
  const currentAnalytics = currentBlock ? featureForBlock(currentBlock.id) : undefined;
  const currentMoisture = mapMoistureReading(currentAnalytics?.properties);
  const focusBlock = currentBlock ?? data.blocks.find(block => block.field.id === mapFieldId) ?? data.blocks[0];
  const focusFeature = focusBlock ? featureForBlock(focusBlock.id) : undefined;
  const moistureSectors = analyticsFeatures.flatMap(feature => feature.properties.irrigationSectors ?? [])
    .filter(sector => data.blocks.some(block => block.id === sector.blockId));
  const latestReadings = moistureSectors.flatMap(sector => sector.latest ? [sector.latest] : []);
  const moistureUnitCounts = latestReadings.reduce<Partial<Record<MoistureUnit, number>>>((counts, reading) => {
    counts[reading.unit] = (counts[reading.unit] ?? 0) + 1;
    return counts;
  }, {});
  const referenceMoistureUnit = (Object.entries(moistureUnitCounts).sort(([, first], [, second]) => second - first)[0]?.[0] as MoistureUnit | undefined) ?? 'VWC_PERCENT';
  const comparableMoisture = latestReadings.filter(reading => reading.unit === referenceMoistureUnit);
  const moistureAverage = comparableMoisture.length ? comparableMoisture.reduce((sum, reading) => sum + reading.value, 0) / comparableMoisture.length : undefined;
  const nutrientRange = summarizeNutrientMap(data.blocks.map(block => nutrientResult(featureForBlock(block.id), nutrient)));
  const { min: nutrientMin, max: nutrientMax, unit: nutrientUnitCode, values: nutrientNumbers } = nutrientRange;
  const nutrientAverage = nutrientNumbers.length ? nutrientNumbers.reduce((sum, value) => sum + value, 0) / nutrientNumbers.length : undefined;
  const focusMoisture = mapMoistureReading(focusFeature?.properties);
  const focusNutrient = nutrientResult(focusFeature, nutrient);
  const focusInterpretation = nutrientInterpretation(focusFeature, nutrient, demo);
  const comparisonLayer: MapLayer | undefined = compare && (layer === 'moisture' || layer === 'nutrients') ? layer === 'moisture' ? 'nutrients' : 'moisture' : undefined;
  const thematic = layer === 'moisture' || layer === 'nutrients';
  const title = layer === 'moisture' ? 'Mapa de humedad del suelo' : layer === 'nutrients' ? 'Mapa de nutrientes del suelo' : layer === 'health' ? 'Salud de tu cultivo' : demo ? 'Mapa de la Finca' : 'Plano de la finca';
  const description = layer === 'moisture' ? 'Explora la humedad del suelo, las mediciones por profundidad y las zonas por revisar.'
    : layer === 'nutrients' ? 'Consulta la distribución por bloque y la trazabilidad de las muestras de suelo.'
    : 'Explora los bloques de la finca y las capas de información disponibles.';
  const nutrientUnit = nutrientUnitCode ? units[nutrientUnitCode] : 'Sin unidad';
  const filteredBlocks = data.blocks.filter(block => (!mapFieldId || block.field.id === mapFieldId)
    && `${block.code} ${block.field.name}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))).slice(0, 6);
  const sensorSectors = moistureSectors.filter(sector => sector.sensorDeviceId != null || sector.latest?.source === 'SENSOR');
  const configuredSectors = moistureSectors.filter(sector => sector.lowerBound != null && sector.upperBound != null);
  const belowRangeSectors = moistureSectors.filter(sector => sector.condition === 'BELOW_RANGE');
  const aboveRangeSectors = moistureSectors.filter(sector => sector.condition === 'ABOVE_RANGE');
  const moistureHistory = (demoIrrigation?.measurements ?? latestReadings)
    .filter(reading => reading.unit === referenceMoistureUnit && moistureSectors.some(sector => sector.id === reading.sectorId))
    .map(reading => ({ date: localDate(new Date(reading.recordedAt)), value: reading.value }));
  const nutrientHistory = (demoFertilization?.analyses ?? analyticsFeatures.flatMap(feature => feature.properties.soilAnalysis ? [feature.properties.soilAnalysis] : []))
    .filter(sample => sample.sampleType === 'SOIL' && data.blocks.some(block => block.id === sample.blockId))
    .flatMap(sample => {
      const result = sample.results.find(item => item.nutrient === mapNutrientCodes[nutrient] && item.unit === nutrientUnitCode);
      return result ? [{ date: sample.sampledOn, value: result.value }] : [];
    });
  const readingProfile = moistureSectors.filter(sector => sector.blockId === focusBlock?.id && sector.latest)
    .sort((first, second) => first.depthCm - second.depthCm);
  const nutrientAreas = nutrientMapColors.map(() => 0);
  data.blocks.forEach(block => {
    const result = nutrientResult(featureForBlock(block.id), nutrient);
    if (result && result.unit === nutrientUnitCode) nutrientAreas[nutrientMapBand(result.value, nutrientMin, nutrientMax)] += block.areaHa ?? 0;
  });
  const sampledArea = nutrientAreas.reduce((sum, area) => sum + area, 0);

  useEffect(() => {
    if (demo || !farmId) return;
    let active = true;
    void Promise.allSettled([api.disease(farmId), api.analyticsMap(farmId)]).then(([disease, analytics]) => {
      if (!active) return;
      setSources({
        farmId,
        disease: disease.status === 'fulfilled' ? disease.value : undefined,
        analytics: analytics.status === 'fulfilled' ? analytics.value : undefined,
        error: disease.status === 'rejected' || analytics.status === 'rejected' ? 'Algunas capas del mapa no están disponibles. Actualiza para volver a consultarlas.' : undefined,
      });
    });
    return () => { active = false; };
  }, [farmId, demo]);

  const activateLayer = (nextLayer: MapLayer) => {
    setLayer(nextLayer);
    if (nextLayer !== 'satellite') setToolsOpen(true);
    else setCompare(false);
  };
  const toggleCompare = () => { if (layer !== 'moisture' && layer !== 'nutrients') setLayer('moisture'); setCompare(value => !value); };
  const nutrientBands = nutrientNumbers.length ? (
    nutrientMin === nutrientMax ? [[2, number(nutrientMin, 2)] as const] : nutrientMapColors.map((_, index) => {
      const step = (nutrientMax - nutrientMin) / nutrientMapColors.length;
      return [index, `${number(nutrientMin + step * index, 2)}–${number(nutrientMin + step * (index + 1), 2)}`] as const;
    })
  ) : [];
  const renderLegend = (activeLayer: MapLayer) => {
    if (activeLayer === 'nutrients' && !nutrientBands.length) return <p className="map-data-note">Sin muestras para este nutriente.</p>;
    const items = activeLayer === 'moisture' ? moistureMapBands.map(band => [band.label, '', band.color] as const)
      : activeLayer === 'health' ? demo ? demoHealthLegend : healthMapBands.map(band => [band.label, '', band.color] as const)
      : activeLayer === 'nutrients' ? nutrientBands.map(([index, range]) => [`${range} ${nutrientUnit}`, sampledArea > 0 ? `${number(nutrientAreas[index], 1)} ha` : '', nutrientMapColors[index]] as const)
      : [['Vista general', 'Límites y cobertura', '#579359']] as const;
    return <div className="legend-list map-legend-list">{items.map(([label, value, color]) => <div key={color}><i style={{ background: color }} /><span>{label}</span>{value && <strong>{value}</strong>}</div>)}</div>;
  };
  const goToTraceability = () => document.getElementById('map-traceability')?.scrollIntoView({ block: 'start' });
  const renderMoistureSummary = () => {
    const latestSector = moistureSectors.filter(sector => sector.latest).sort((first, second) => Date.parse(second.latest!.recordedAt) - Date.parse(first.latest!.recordedAt))[0];
    if (moistureView === 'sensors') return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{sensorSectors.length}<span> sensores</span></strong><Badge>Seguimiento</Badge></div><p className="muted">Sectores con sensor asignado o lectura identificada como sensor.</p><div className="map-selected-reading"><span>Lecturas disponibles</span><strong>{sensorSectors.filter(sector => sector.latest).length}</strong><small>Consulta cada sensor desde la tabla de trazabilidad.</small></div></>;
    if (moistureView === 'zones') return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{moistureSectors.length}<span> zonas</span></strong><Badge>Configuradas</Badge></div><p className="muted">Sectores hidráulicos asociados a los bloques del mapa.</p><div className="map-selected-reading"><span>Con límites técnicos</span><strong>{configuredSectors.length}</strong><small>{moistureSectors.length - configuredSectors.length} sin límites configurados.</small></div></>;
    if (moistureView === 'history') return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{latestReadings.length}<span> lecturas</span></strong></div><p className="muted">Última lectura registrada por sector, conservando unidad y fecha.</p><div className="map-selected-reading"><span>{latestSector?.name ?? 'Última lectura'}</span><strong>{latestSector?.latest ? `${latestSector.latest.value} ${moistureMapUnits[latestSector.latest.unit]}` : 'Sin dato'}</strong><small>{latestSector?.latest ? new Date(latestSector.latest.recordedAt).toLocaleString('es-CO') : 'No hay lecturas disponibles.'}</small></div></>;
    if (moistureView === 'recommendations') return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{belowRangeSectors.length + aboveRangeSectors.length}<span> revisiones</span></strong><Badge>Por verificar</Badge></div><p className="muted">Prioriza la revisión de lecturas fuera del rango configurado antes de ajustar un riego.</p><div className="map-selected-reading"><span>Por debajo / por encima</span><strong>{belowRangeSectors.length} / {aboveRangeSectors.length}</strong><small>La interfaz no convierte estos estados en una recomendación automática.</small></div></>;
    return <><div className="layer-metric"><span className="stat-icon blue"><Droplets size={28} /></span><strong>{moistureAverage == null ? '—' : number(moistureAverage, 1)}<span>{moistureAverage == null ? '' : ` ${moistureMapUnits[referenceMoistureUnit]}`}</span></strong><Badge>Valor visible</Badge></div><p className="muted">Promedio calculado con lecturas que comparten la unidad {moistureUnits[referenceMoistureUnit]}.</p><div className="map-selected-reading"><span>{focusBlock?.code ?? 'Bloque seleccionado'}</span><strong>{shortMoistureValue(focusMoisture)}</strong><small>{focusMoisture.condition ? moistureLabels[focusMoisture.condition as keyof typeof moistureLabels] ?? focusMoisture.condition : 'Sin condición registrada'}</small></div><div className="moisture-spectrum"><i /><i /><i /><i /><i /></div><div className="spectrum-labels"><span>Muy seco</span><span>Óptimo</span><span>Exceso</span></div></>;
  };

  return <div className={`map-workspace ${thematic ? 'thematic-map' : ''}`}>
    <div className="page-heading maps-heading">
      <div><h1>{title}</h1><p>{description}</p></div>
      <div className="maps-view-toolbar">
        <button type="button" className={`maps-compare-button ${compare ? 'active' : ''}`} onClick={toggleCompare}><Layers size={16} />{compare ? 'Comparación activa' : 'Comparar capas'}</button>
        <select aria-label="Mapa base" value={viewMode} onChange={event => setViewMode(event.target.value as typeof viewMode)}>
          <option value="satellite">Satélite</option>
          {!demo && <option value="hybrid">Híbrido</option>}
          <option value="map">Plano</option>
        </select>
        <button className="maps-tools-button" aria-expanded={toolsOpen} onClick={() => setToolsOpen(value => !value)}><Wrench size={16} />Capas del mapa</button>
        <button className="maps-expand-button" aria-label="Ampliar mapa" onClick={() => setExpandSignal(value => value + 1)}><Maximize2 size={16} /></button>
      </div>
    </div>
    <div className={`map-tabs maps-layer-tabs ${layer}`}>
      <div className="maps-layer-tab-list">{layers.map(item => <button key={item.id} type="button" aria-pressed={layer === item.id} className={layer === item.id ? 'active' : ''} onClick={() => activateLayer(item.id)}><item.icon size={17} />{item.label}</button>)}</div>
      <span className="map-demo-label">{demo ? 'Datos de demostración' : 'Datos del servidor'}</span>
    </div>
    {layer === 'moisture' && <div className="maps-layer-subtabs">{moistureViews.map(view => <button key={view.id} className={moistureView === view.id ? 'active' : ''} aria-pressed={moistureView === view.id} type="button" onClick={() => setMoistureView(view.id)}>{view.label}</button>)}</div>}
    {layer === 'nutrients' && <div className="nutrient-tabs maps-nutrient-tabs">{Object.values(nutrientNames).map(label => <button key={label} type="button" aria-pressed={nutrient === label} className={nutrient === label ? 'active' : ''} onClick={() => setNutrient(label)}>{label}</button>)}</div>}
    {!demo && <Notice>El plano muestra límites, observaciones de salud y la última telemetría disponible por bloque. Las capas se actualizan al consultar el servidor.</Notice>}
    {!demo && data.fields.some(field => field.name.includes('[PRUEBA]')) && <Notice>Plano de prueba: las divisiones marcadas [PRUEBA] tienen ubicación y linderos ficticios. No representan un levantamiento de la finca.</Notice>}
    {currentSources?.error && <div className="error-banner" role="alert">{currentSources.error}</div>}
    {loading && <div className="notice"><RefreshCw className="spin" size={17} />Cargando observaciones geográficas…</div>}
    {layer === 'health' && <Notice>Rojo: hallazgos activos. Verde: muestra reciente sin hallazgos activos. Gris: sin evaluación reciente. La vigencia vence en la próxima visita o a los 30 días; no es un diagnóstico de todo el bloque.</Notice>}
    <div className="map-page-grid">
      <Panel className="map-stage"><FarmMap key={farmId} large farm={data.farms[0]} fields={data.fields} blocks={data.blocks} rows={data.rows} layer={layer} comparisonLayer={comparisonLayer} nutrient={nutrient} selected={selected} onSelect={setSelected} onInspectBlock={thematic ? goToTraceability : undefined} onLayerChange={activateLayer} toolsOpen={toolsOpen} onToolsChange={setToolsOpen} expandSignal={expandSignal} demo={demo} disease={currentSources?.disease} analytics={visibleAnalytics} baseLayer={viewMode}
        legend={demo && layer === 'satellite' && <div className="maps-mini-map map-stage-mini-map">
          <img src="/images/farm-aerial.png" alt="Vista general de la finca" /><span>N</span>
        </div>} /></Panel>
      <aside className="map-info">
        {compare && <Panel title="Capas activas">
          <div className="map-compare-metrics">
            <div className="map-compare-metric"><span className="stat-icon blue"><Droplets size={21} /></span><div><span>Humedad del suelo</span><strong>{moistureAverage == null ? 'Sin dato' : `${number(moistureAverage, 1)} ${moistureMapUnits[referenceMoistureUnit]}`}</strong></div></div>
            <div className="map-compare-metric"><span className="stat-icon green"><FlaskConical size={21} /></span><div><span>{nutrient}</span><strong>{nutrientAverage == null ? 'Sin dato' : `${number(nutrientAverage, 2)} ${nutrientUnit}`}</strong></div></div>
          </div>
        </Panel>}
        {!compare && layer === 'moisture' && <>
          <Panel title="Humedad promedio de la finca">
            <div className="layer-metric"><span className="stat-icon blue"><Droplets size={26} /></span><strong>{moistureAverage == null ? '—' : `${number(moistureAverage, 1)} ${moistureMapUnits[referenceMoistureUnit]}`}</strong></div>
            <p className="map-data-note">{comparableMoisture.length ? `${comparableMoisture.length} últimas lecturas en ${moistureUnits[referenceMoistureUnit]}` : 'Sin lecturas registradas.'}</p>
            {moistureSectors.length > 0 && <div className="map-moisture-spectrum" aria-label="Distribución por condición">
              {moistureMapBands.map(band => {
                const count = moistureSectors.filter(sector => sector.condition === band.status).length;
                return count ? <i key={band.status} title={`${band.label} · ${count}`} style={{ background: band.color, flex: count }} /> : null;
              })}
            </div>}
            {currentBlock && <div className="map-selected-reading"><span>{currentBlock.code}</span><strong>{shortMoistureValue(focusMoisture)}</strong>
              <small>{moistureLabels[focusMoisture.condition as keyof typeof moistureLabels] ?? 'Sin condición registrada'}</small>
            </div>}
          </Panel>
          {moistureView === 'soil' ? <Panel title="Sensores de humedad" action={<LinkButton onClick={() => setMoistureView('sensors')}>Ver sensores</LinkButton>}>
            <div className="map-sensor-count"><span className="stat-icon green"><Radio size={21} /></span><div><strong>{sensorSectors.length}</strong><small>Sectores con sensor</small></div></div>
            <div className="map-summary-rows">{moistureSectors.slice(0, 4).map(sector => <button type="button" key={sector.id} onClick={() => setSelected(sector.blockId)}>
              <span>{sector.name}</span><strong>{shortMoistureValue({ value: sector.latest?.value, unit: sector.latest?.unit })}</strong>
              <i style={{ background: moistureMapColor(sector.condition) }} title={moistureLabels[sector.condition]} />
            </button>)}</div>
          </Panel> : <Panel title={moistureViews.find(view => view.id === moistureView)?.label ?? 'Detalle de humedad'}>{renderMoistureSummary()}</Panel>}
        </>}
        {!compare && layer === 'nutrients' && <Panel title="Información de la capa">
          <div className="map-layer-description"><span className="stat-icon green"><Sprout size={23} /></span><div><strong>{nutrient}</strong><p className="map-data-note">{nutrientNumbers.length} muestras comparables{nutrientUnitCode ? ` · ${nutrientUnit}` : ''}</p></div></div>
          <div className="map-selected-reading">
            <span>{focusBlock?.code ?? 'Sin bloque'}</span>
            <strong>{focusNutrient ? `${number(focusNutrient.value, 2)} ${units[focusNutrient.unit]}` : 'Sin muestra'}</strong>
            <small>{focusFeature?.properties.soilAnalysis?.reference ?? 'Sin referencia de laboratorio'}</small>
          </div>
        </Panel>}
        {!thematic && <Panel className="map-farm-summary">
          <div className="map-farm-heading">
            {demo && <div className="farm-thumbnail" aria-hidden="true" />}
            <div>
              <h3 className="farm-info-name">{currentBlock?.code ?? data.farms[0]?.name ?? 'Información de la finca'}</h3>
              {currentBlock && <p>{currentBlock.field.name}</p>}
              {data.farms[0]?.region && <div className="info-line"><MapPin size={15} /><span>{data.farms[0].region}</span></div>}
            </div>
          </div>
          <dl className="detail-list map-farm-facts">
            <div><dt>Área {currentBlock ? 'del bloque' : 'total'}</dt><dd>{area == null ? 'Sin registrar' : `${number(area, 1)} ha`}</dd></div>
            <div><dt>Campos</dt><dd>{data.fields.length}</dd></div>
            <div><dt>Bloques</dt><dd>{data.blocks.length}</dd></div>
            <div><dt>Filas</dt><dd>{data.rows.length}</dd></div>
            <div><dt>Plantas estimadas</dt><dd>{hasPlantEstimates ? number(metrics.plants) : 'Sin registrar'}</dd></div>
            {currentBlock && <div><dt>Variedad</dt><dd>{currentBlock.variety ?? 'Sin registrar'}</dd></div>}
            {!demo && currentAnalytics && <>
              <div><dt>Humedad del suelo</dt><dd>{shortMoistureValue(currentMoisture)}</dd></div>
              <div><dt>Condición</dt><dd>{currentMoisture.condition ? moistureLabels[currentMoisture.condition] : 'Sin condición por bloque'}</dd></div>
              <div><dt>Evaluación sanitaria</dt><dd>{healthLabels[currentAnalytics.properties.healthStatus ?? 'NO_RECENT_INSPECTION']}</dd></div>
            </>}
          </dl>
          <button className="button full-width" onClick={() => navigate('reports')}>Ver actividad de la finca<ArrowRight size={15} /></button>
        </Panel>}
        {(compare || layer !== 'moisture' || !demo) && <Panel title={compare ? 'Leyendas de capas' : layer === 'nutrients' ? 'Leyenda de la capa' : 'Leyenda'}>
          {compare && <div className="map-legend-group"><strong>Humedad del suelo</strong>{renderLegend('moisture')}</div>}
          {compare && <div className="map-legend-group"><strong>{nutrient}</strong>{renderLegend('nutrients')}</div>}
          {!compare && renderLegend(layer)}
        </Panel>}
        {!compare && layer === 'nutrients' && <Panel title="Estadísticas del área">
          {sampledArea > 0 ? <div className="map-area-stat"><Donut value={`${number(sampledArea, 1)} ha`} label="Área muestreada" segments={nutrientAreas} colors={nutrientMapColors} />
            <div><strong>{nutrientAverage == null ? '—' : `${number(nutrientAverage, 2)} ${nutrientUnit}`}</strong><p className="map-data-note">Promedio de muestras</p></div></div>
            : <p className="map-data-note">Sin áreas con muestras comparables.</p>}
        </Panel>}
        {layer === 'health' && <Panel title="Estado de la muestra"><p>{currentBlock ? healthLabels[currentAnalytics?.properties.healthStatus ?? 'NO_RECENT_INSPECTION'] : 'Selecciona un bloque para consultar su evaluación.'}</p><button className="text-button" onClick={() => navigate('disease')}>Consultar inspecciones</button></Panel>}
        {demo && <div className="map-help"><Leaf size={19} /><p>Haz clic en un bloque del mapa para consultar el valor de la capa activa.</p></div>}
      </aside>
    </div>
    {thematic && <div className="map-bottom-grid">
      <Panel title={demo ? layer === 'moisture' ? 'Evolución de la humedad del suelo' : `Evolución de ${nutrient}` : layer === 'moisture' ? 'Últimas lecturas por sector' : `Últimas muestras por bloque · ${nutrient}`}>
        <LayerTrend samples={layer === 'moisture' ? moistureHistory : nutrientHistory} unit={layer === 'moisture' ? moistureMapUnits[referenceMoistureUnit] : nutrientUnit} />
      </Panel>
      {layer === 'moisture' ? <Panel title="Perfil de humedad del suelo" action={focusBlock ? <Badge tone="neutral">{focusBlock.code}</Badge> : undefined}>
        <div className="map-depth-profile">
          <div className="map-depth-illustration" aria-hidden="true"><Sprout size={35} /><i /></div>
          <div className="map-summary-rows">{readingProfile.map(sector => <div key={sector.id}>
            <span>{sector.latest?.depthCm ?? sector.depthCm} cm</span><strong>{shortMoistureValue({ value: sector.latest?.value, unit: sector.latest?.unit })}</strong>
            <i style={{ background: moistureMapColor(sector.condition) }} />
          </div>)}{!readingProfile.length && <p className="map-data-note">Sin mediciones por profundidad para este bloque.</p>}</div>
        </div>
      </Panel> : <Panel title="Comparativa por bloque">
        <div className="bar-list map-bar-list">{filteredBlocks.map(block => {
          const result = nutrientResult(featureForBlock(block.id), nutrient);
          const comparable = result && result.unit === nutrientUnitCode;
          return <button className={`bar-row ${selected === block.id ? 'selected-bar' : ''}`} key={block.id} onClick={() => setSelected(block.id)}>
            <span>{block.code}</span><div><i style={{
              width: `${comparable ? Math.max(0, result.value) / (nutrientMax || 1) * 100 : 0}%`,
              background: comparable ? nutrientMapColors[nutrientMapBand(result.value, nutrientMin, nutrientMax)] : undefined,
            }} /></div><strong>{result ? `${number(result.value, 2)} ${units[result.unit]}` : 'Sin dato'}</strong>
          </button>;
        })}</div>
      </Panel>}
      {layer === 'moisture' ? <Panel title="Zonas que requieren revisión" action={<LinkButton onClick={() => navigate('irrigation')}>Ir a Riego</LinkButton>}>
        <div className="map-review-list">{[...belowRangeSectors, ...aboveRangeSectors].slice(0, 4).map(sector => <button key={sector.id} type="button" onClick={() => setSelected(sector.blockId)}>
          <TriangleAlert size={18} /><span><strong>{sector.name}</strong><small>{moistureLabels[sector.condition]}</small></span><strong>{shortMoistureValue({ value: sector.latest?.value, unit: sector.latest?.unit })}</strong>
        </button>)}</div>
        {!belowRangeSectors.length && !aboveRangeSectors.length && <p className="map-data-note">Sin zonas fuera del rango configurado.</p>}
      </Panel> : <Panel title="Revisión técnica" action={<LinkButton onClick={() => navigate('fertilization')}>Ir a Fertilización</LinkButton>}>
        <div className="map-layer-description"><span className="stat-icon green"><Sprout size={23} /></span><div><strong>{focusBlock?.code ?? 'Sin bloque'}</strong>
          {focusInterpretation && <Badge tone={nutrientStatusTones[focusInterpretation.status]}>{focusInterpretation.label}</Badge>}
          <p className="map-data-note">{focusInterpretation?.reason ?? 'Sin muestra compatible con el perfil de referencia.'}</p>
        </div></div>
        <button className="text-button" onClick={goToTraceability}>Ver trazabilidad <ArrowRight size={15} /></button>
      </Panel>}
    </div>}
    {demo && layer === 'satellite' && <div className="map-bottom-grid">
      <Panel title="Distribución de área por bloque"><div className="area-distribution">
        <Donut value={`${number(metrics.area)} ha`} label="Total" segments={data.blocks.map(block => block.areaHa ?? 0)} colors={data.blocks.map((_, index) => nutrientMapColors[index % nutrientMapColors.length])} />
        <div className="legend-list">{data.blocks.map((block, index) => <div key={block.id}><i style={{ background: nutrientMapColors[index % nutrientMapColors.length] }} /><span>{block.code}</span><strong>{block.areaHa} ha</strong></div>)}</div>
      </div></Panel>
      <Panel title="Índice de vegetación (NDVI)" action={<Badge tone="neutral">Ejemplo</Badge>}><LineChart /></Panel>
      <Panel title="Últimas actividades" action={<LinkButton onClick={() => navigate('reports')}>Ver todo</LinkButton>}><EventList limit={4} /></Panel>
    </div>}
    {!demo && layer === 'health' && <Panel title="Detalle de las observaciones" className="map-observations"><div className="table-wrap">
      <table><thead><tr><th>Surco</th><th>Severidad máxima</th><th>Observaciones</th><th>Último registro</th></tr></thead><tbody>{currentSources?.disease?.features.map(feature => <tr key={feature.properties.rowId}><td>{feature.properties.rowCode}</td><td>{feature.properties.maxSeverity ?? 'Sin dato'}</td><td>{feature.properties.countObservations}</td><td>{feature.properties.lastObservedAt ? new Date(feature.properties.lastObservedAt).toLocaleString('es-CO') : 'Sin fecha'}</td></tr>)}</tbody></table>
    </div></Panel>}
    <div id="map-traceability" className="map-traceability-stack">
    {layer === 'moisture' && <Panel title="Humedad por sector y trazabilidad" className="map-traceability"><div className="table-wrap"><table><thead><tr><th>Bloque / sector</th><th>Medición / unidad</th><th>Profundidad / origen</th><th>Fecha / vigencia</th><th>Rango configurado</th><th>Estado</th></tr></thead><tbody>{data.blocks.flatMap(block => { const matches = moistureSectors.filter(sector => sector.blockId === block.id); return matches.length ? matches.map(sector => <tr key={sector.id}><td><button className="text-button" onClick={() => setSelected(block.id)}>{block.code} · {sector.name}</button></td><td>{sector.latest?.value ?? 'Sin dato'} {moistureUnits[sector.unit]}</td><td>{sector.depthCm} cm · {sector.latest?.source === 'SENSOR' ? 'Sensor' : sector.latest ? 'Manual' : 'Sin lectura'}</td><td>{sector.latest ? new Date(sector.latest.recordedAt).toLocaleString('es-CO') : 'Sin fecha'} · {sector.maxAgeHours} h</td><td>{sector.lowerBound != null ? `${sector.lowerBound}–${sector.upperBound} ${moistureUnits[sector.unit]}` : 'Sin límites técnicos'}</td><td>{moistureLabels[sector.condition]}</td></tr>) : [<tr key={`block-${block.id}`}><td>{block.code}</td><td colSpan={5}>Sin sector configurado; no se clasifican datos sin unidad.</td></tr>]; })}</tbody></table></div></Panel>}
    {layer === 'nutrients' && <Panel title={`${nutrient}: trazabilidad del muestreo`} className="map-traceability"><div className="table-wrap"><table><thead><tr><th>Bloque</th><th>Valor</th><th>Unidad</th><th>Fecha / muestra</th><th>Método / laboratorio</th></tr></thead><tbody>{data.blocks.map(block => { const sample = featureForBlock(block.id)?.properties.soilAnalysis; const result = nutrientResult(featureForBlock(block.id), nutrient); return <tr key={block.id}><td><button className="text-button" onClick={() => setSelected(block.id)}>{block.code}</button></td><td>{result?.value ?? 'Sin dato'}</td><td>{result ? units[result.unit] : '—'}</td><td>{sample ? `${sample.sampledOn} · ${sample.reference}` : 'Sin muestra'}</td><td>{result?.method ?? '—'}<br />{sample?.laboratory ?? 'Sin laboratorio'}</td></tr>; })}</tbody></table></div></Panel>}
    {layer === 'nutrients' && <Panel title={`${nutrient}: interpretación por bloque`} className="map-traceability"><div className="table-wrap"><table><thead><tr><th>Bloque</th><th>Estado</th><th>Fundamento</th></tr></thead><tbody>{data.blocks.map(block => { const feature = featureForBlock(block.id); const interpretation = nutrientInterpretation(feature, nutrient, demo); return <tr key={block.id}><td><button className="text-button" onClick={() => setSelected(block.id)}>{block.code}</button></td><td>{interpretation ? <Badge tone={nutrientStatusTones[interpretation.status]}>{interpretation.label}</Badge> : nutrientResult(feature, nutrient) ? 'Sin interpretar' : 'Sin muestra'}</td><td>{interpretation?.reason ?? 'Sin interpretación disponible.'}</td></tr>; })}</tbody></table></div><p className="muted">El estado depende del perfil de referencia de la muestra y requiere revisión técnica.</p></Panel>}
    </div>
  </div>;
}
