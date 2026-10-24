import { useEffect, useId, useState } from 'react';
import { Plus, Minus, LocateFixed, Layers, Maximize, Navigation, X, ArrowUpRight, SquareStack, Rows3, Sprout, Leaf, Activity, Bug, ChartNoAxesCombined, Droplets, FlaskConical } from 'lucide-react';
import { blockHealth } from '../lib/demo';
import { moistureLabels, moistureUnits } from '../lib/irrigation';
import { interpretNutrient, units } from '../lib/fertilization';
import type { AnalyticsLayer, Block, DiseaseLayer, Field, PolygonGeometry } from '../lib/types';
import { healthLabels } from '../lib/inspections';

export type MapLayer = 'satellite' | 'health' | 'moisture' | 'nutrients';
const plots = [
  { points: '80,70 410,32 454,230 90,275', center: [260, 150] },
  { points: '410,32 700,83 760,255 454,230', center: [585, 145] },
  { points: '454,230 760,255 680,433 355,401', center: [560, 315] },
  { points: '90,275 454,230 355,401 62,350', center: [220, 315] },
  { points: '760,255 825,320 720,450 680,433', center: [730, 350] },
];
const tones = { satellite: ['#77ae43', '#9cba35', '#5fa247', '#76a440', '#7cb746'], health: ['#62b65d', '#e7c441', '#5db36a', '#eb7150', '#89ba55'], moisture: ['#46a8ef', '#efb744', '#65b67a', '#ef7450', '#76b750'], nutrients: ['#e3bd43', '#ed8548', '#53b772', '#ed6e44', '#89b857'] };
const demoHealthLabels = [
  { title: 'Campo A', detail: '52 ha', color: '#4eaf5c' },
  { title: 'Bajo K', detail: 'A3 · 14 ha', color: '#efc335' },
  { title: 'Sigatoka', detail: 'B2 · 18 ha', color: '#e45248' },
  { title: 'Riego activo', detail: 'C1 · 20 ha', color: '#3c87e8' },
  { title: 'Humedad baja', detail: 'D1 · 16 ha', color: '#ef8b2d' },
];
const nutrientCodes: Record<string, string> = { 'Nitrógeno (N)': 'N', 'Fósforo (P)': 'P', 'Potasio (K)': 'K', pH: 'PH', 'Materia orgánica': 'OM', 'Calcio (Ca)': 'CA', 'Magnesio (Mg)': 'MG', 'Azufre (S)': 'S', 'Boro (B)': 'B', 'Zinc (Zn)': 'ZN' };
const nutrientPalette = ['#ef6b53', '#f4a449', '#edcf50', '#73b96b', '#5386f5'];
const moistureShortUnits = { VWC_PERCENT: '%', GRAV_PERCENT: '%', KPA: 'kPa' };
const layerLabels: Record<MapLayer, string> = { satellite: 'Vista de la finca', health: 'Salud del cultivo', moisture: 'Humedad del suelo', nutrients: 'Nutrientes del suelo' };

export default function FarmMap({ blocks, fields = [], layer = 'satellite', comparisonLayer, nutrient = 'Nitrógeno (N)', large = false, selected, onSelect, onLayerChange, toolsOpen, onToolsChange, expandSignal, demo = true, disease, analytics }: { blocks: Block[]; fields?: Field[]; layer?: MapLayer; comparisonLayer?: MapLayer; nutrient?: string; large?: boolean; selected?: number; onSelect?: (id: number) => void; onLayerChange?: (layer: MapLayer) => void; toolsOpen?: boolean; onToolsChange?: (open: boolean) => void; expandSignal?: number; demo?: boolean; disease?: DiseaseLayer; analytics?: AnalyticsLayer }) {
  const [zoom, setZoom] = useState(1);
  const [layersOpen, setLayersOpen] = useState(large);
  const [boundaries, setBoundaries] = useState(true);
  const [rows, setRows] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedField, setSelectedField] = useState(0);
  useEffect(() => { if (toolsOpen !== undefined) setLayersOpen(toolsOpen); }, [toolsOpen]);
  useEffect(() => { if (expandSignal) setExpanded(value => !value); }, [expandSignal]);
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', close); };
  }, [expanded]);
  const identifier = useId().replaceAll(':', '');
  const chosen = blocks.find(block => block.id === selected);
  const chosenField = fields.find(field => field.id === selectedField);
  const analyticsByBlock = new Map((analytics?.features ?? []).map(feature => [feature.properties.blockId, feature.properties]));
  const mappedFields = fields.filter(field => field.geom?.coordinates[0]?.length);
  const mappedBlocks = blocks.filter(block => block.geom?.coordinates[0]?.length);
  const coordinates = [...mappedFields.flatMap(field => field.geom!.coordinates.flat()), ...mappedBlocks.flatMap(block => block.geom!.coordinates.flat()), ...(disease?.features.flatMap(feature => feature.geometry.coordinates) ?? [])];
  const coordinateX = coordinates.map(point => point[0]);
  const coordinateY = coordinates.map(point => point[1]);
  const minX = coordinateX.length ? Math.min(...coordinateX) : 0;
  const maxX = coordinateX.length ? Math.max(...coordinateX) : 1;
  const minY = coordinateY.length ? Math.min(...coordinateY) : 0;
  const maxY = coordinateY.length ? Math.max(...coordinateY) : 1;
  const longitudeScale = Math.cos((minY + maxY) / 2 * Math.PI / 180) || 1;
  const scale = Math.min(730 / ((maxX - minX) * longitudeScale || 1), 360 / (maxY - minY || 1));
  const project = (point: number[]) => `${430 + (point[0] - (minX + maxX) / 2) * longitudeScale * scale},${245 - (point[1] - (minY + maxY) / 2) * scale}`;
  const polygonPath = (geometry: PolygonGeometry) => geometry.coordinates.map(ring => `M${ring.map(project).join(' L')} Z`).join(' ');
  const labelPosition = (geometry: PolygonGeometry) => {
    const ring = geometry.coordinates[0];
    return project([(Math.min(...ring.map(point => point[0])) + Math.max(...ring.map(point => point[0]))) / 2, (Math.min(...ring.map(point => point[1])) + Math.max(...ring.map(point => point[1]))) / 2]).split(',').map(Number);
  };
  const nutrientResult = (properties?: AnalyticsLayer['features'][number]['properties']) => properties?.soilAnalysis?.results.find(result => result.nutrient === nutrientCodes[nutrient]);
  const nutrientValue = (properties?: AnalyticsLayer['features'][number]['properties']) => {
    const result = nutrientResult(properties);
    if (result) return result.value;
    const legacyValues: Record<string, number | undefined> = { N: properties?.nitrogen, P: properties?.phosphorus, K: properties?.potassium, PH: properties?.ph };
    return legacyValues[nutrientCodes[nutrient]];
  };
  const allNutrientValues = blocks.map(block => nutrientValue(analyticsByBlock.get(block.id))).filter((value): value is number => value != null && Number.isFinite(value));
  const nutrientMin = allNutrientValues.length ? Math.min(...allNutrientValues) : undefined;
  const nutrientMax = allNutrientValues.length ? Math.max(...allNutrientValues) : undefined;
  const nutrientColor = (value?: number) => {
    if (value == null) return '#b5c2ae';
    const ratio = nutrientMin == null || nutrientMax == null || nutrientMax === nutrientMin ? .5 : (value - nutrientMin) / (nutrientMax - nutrientMin);
    return nutrientPalette[Math.max(0, Math.min(nutrientPalette.length - 1, Math.floor(ratio * nutrientPalette.length)))];
  };
  const moistureReading = (properties?: AnalyticsLayer['features'][number]['properties']) => {
    const sector = properties?.irrigationSectors?.find(item => item.latest) ?? properties?.irrigationSectors?.[0];
    return { value: sector?.latest?.value ?? properties?.soilMoisture, unit: sector?.latest?.unit ?? sector?.unit, condition: sector?.condition ?? properties?.conditionStatus };
  };
  const moistureLabel = (properties?: AnalyticsLayer['features'][number]['properties']) => {
    const reading = moistureReading(properties);
    if (reading.value == null) return 'Sin dato';
    const unit = reading.unit ? moistureShortUnits[reading.unit] : '%';
    const condition = reading.condition ? moistureLabels[reading.condition as keyof typeof moistureLabels] ?? reading.condition : 'Sin condición';
    return `${reading.value} ${unit} · ${condition}`;
  };
  const liveColor = (block: Block, activeLayer: MapLayer) => {
    const properties = analyticsByBlock.get(block.id);
    if (activeLayer === 'satellite') return '#579359';
    if (!properties) return '#b5c2ae';
    if (activeLayer === 'moisture') {
      const condition = moistureReading(properties).condition;
      return condition === 'BELOW_RANGE' || condition === 'DRY' ? '#edb445' : condition === 'ABOVE_RANGE' || condition === 'WET' ? '#5386f5' : condition === 'IN_RANGE' || condition === 'OPTIMAL' ? '#65b67a' : '#b5c2ae';
    }
    if (activeLayer === 'health') return properties.healthStatus === 'ACTIVE_FINDINGS' ? '#eb7150' : properties.healthStatus === 'NO_ACTIVE_FINDINGS' ? '#62b65d' : '#b5c2ae';
    return nutrientColor(nutrientValue(properties));
  };
  const liveLabel = (block: Block, activeLayer = layer) => {
    const properties = analyticsByBlock.get(block.id);
    if (!properties) return `${block.code}: sin datos`;
    if (activeLayer === 'moisture') return `${block.code}: ${moistureLabel(properties)}`;
    if (activeLayer === 'health') return `${block.code}: ${healthLabels[properties.healthStatus ?? 'NO_RECENT_INSPECTION']}`;
    if (activeLayer === 'nutrients') { const result = nutrientResult(properties); const interpretation = result ? interpretNutrient(result, properties.crop, properties.soilAnalysis?.sampleType ?? 'SOIL') : undefined; return `${block.code}: ${nutrient} ${nutrientValue(properties) ?? 'sin dato'} ${result ? units[result.unit] : ''} · ${interpretation?.label ?? 'Sin interpretar'} · ${properties.soilAnalysis?.sampledOn ?? 'Sin muestra'}`; }
    return `${block.code}: ${properties.areaHa ?? block.areaHa ?? 'sin dato'} ha`;
  };
  const mapLegend = (activeLayer: MapLayer) => {
    const items = activeLayer === 'moisture' ? [['Muy seco', '< 10%', '#ef6b53'], ['Seco', '10–20%', '#f4a449'], ['Óptimo', '20–30%', '#73b96b'], ['Exceso', '> 40%', '#5386f5']] : activeLayer === 'nutrients' ? [0, 1, 2, 3, 4].map(index => { const value = nutrientMin == null || nutrientMax == null ? 'Sin dato' : `${(nutrientMin + (nutrientMax - nutrientMin) * index / 4).toFixed(2)} ${nutrientResult(analytics?.features[0]?.properties)?.unit ? units[nutrientResult(analytics?.features[0]?.properties)!.unit] : ''}`; return [index === 0 ? 'Más bajo' : index === 4 ? 'Más alto' : 'Intermedio', value, nutrientPalette[index]]; }) : activeLayer === 'health' ? [['Hallazgos activos', 'Severidad registrada', '#eb7150'], ['Sin hallazgos activos', 'Evaluación reciente', '#62b65d'], ['Sin evaluación reciente', 'Sin dato vigente', '#b5c2ae']] : [['Vista general', 'Límites y cobertura', '#579359']];
    return <div className="map-layer-inline-legend"><strong>{layerLabels[activeLayer]}</strong>{items.map(([label, value, color], index) => <span key={`${label}-${index}`}><i style={{ background: color }} />{label}<b>{value}</b></span>)}</div>;
  };
  const renderDemoLayer = (activeLayer: MapLayer, clipPath?: string) => <g clipPath={clipPath ? `url(#${clipPath})` : undefined} style={{ transform: `translate(430px, 245px) scale(${zoom}) translate(-430px, -245px)`, transition: 'transform .25s ease' }}>{plots.map((plot, plotIndex) => {
    const block = blocks[plotIndex];
    if (!block) return null;
    const properties = analyticsByBlock.get(block.id);
    const demoLabel = activeLayer === 'health' ? demoHealthLabels[plotIndex] : undefined;
    const fill = demoLabel?.color ?? (activeLayer === 'satellite' ? tones.satellite[plotIndex] : liveColor(block, activeLayer));
    const reading = moistureReading(properties);
    const nutrient = nutrientValue(properties);
    const detail = demoLabel?.detail ?? (activeLayer === 'moisture' ? `${reading.value ?? '—'} ${reading.unit ? moistureShortUnits[reading.unit] : '%'}` : activeLayer === 'nutrients' ? `${nutrient ?? '—'} ${nutrientResult(properties) ? units[nutrientResult(properties)!.unit] : ''}` : `${block.areaHa ?? '—'} ha`);
    return <g key={`${activeLayer}-${block.id}`} className="map-plot" role="button" tabIndex={0} aria-label={`Seleccionar ${block.code}`} onClick={() => onSelect?.(block.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(block.id); } }}><title>{demoLabel ? `${demoLabel.title} · ${demoLabel.detail}` : liveLabel(block, activeLayer)}</title><polygon points={plot.points} fill={fill} fillOpacity={activeLayer === 'satellite' ? '.12' : '.67'} stroke={boundaries ? '#fffce9' : 'transparent'} strokeWidth={selected === block.id ? 4.5 : 2.3} />{rows && <polygon points={plot.points} fill={`url(#rows-${identifier})`} />}<rect x={plot.center[0] - 55} y={plot.center[1] - 23} width="110" height="48" rx="7" fill="#f8fff0" fillOpacity=".94" />{demoLabel && <circle cx={plot.center[0] - 41} cy={plot.center[1] - 5} r="8" fill={demoLabel.color} />}<text x={plot.center[0] + (demoLabel ? 5 : 0)} y={plot.center[1] - 3} textAnchor="middle" fill="#23382a" fontSize="12" fontWeight="700">{demoLabel?.title ?? block.code}</text><text x={plot.center[0] + (demoLabel ? 5 : 0)} y={plot.center[1] + 14} textAnchor="middle" fill="#43513f" fontSize="10">{detail}</text></g>;
  })}</g>;
  const renderLiveLayer = (activeLayer: MapLayer, clipPath?: string) => <g clipPath={clipPath ? `url(#${clipPath})` : undefined} style={{ transform: `translate(430px, 245px) scale(${zoom}) translate(-430px, -245px)`, transition: 'transform .25s ease' }}>{mappedFields.map((field, fieldIndex) => {
    const [labelX, labelY] = labelPosition(field.geom!);
    return <g key={`${activeLayer}-field-${field.id}`} className="map-plot" role="button" tabIndex={0} aria-label={`Seleccionar campo ${field.name}`} onClick={() => { setSelectedField(field.id); onSelect?.(0); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedField(field.id); onSelect?.(0); } }}><path d={polygonPath(field.geom!)} fill={tones.satellite[fieldIndex % tones.satellite.length]} fillOpacity={activeLayer === 'satellite' ? '.3' : '.12'} fillRule="evenodd" stroke="#366c42" strokeWidth={selectedField === field.id ? 4 : 2} /><title>{field.name}: {field.areaHa ?? 'Sin área'} ha</title><text x={labelX} y={labelY - 3} textAnchor="middle" fill="#23382a" fontSize="12" fontWeight="700" pointerEvents="none">{field.name.replace(' [PRUEBA]', '')}</text><text x={labelX} y={labelY + 15} textAnchor="middle" fill="#43513f" fontSize="11" pointerEvents="none">{field.areaHa ?? '—'} ha</text></g>;
  })}{mappedBlocks.map(block => <path key={`${activeLayer}-block-${block.id}`} className="map-plot" role="button" tabIndex={0} aria-label={`Seleccionar ${block.code}`} d={polygonPath(block.geom!)} fill={liveColor(block, activeLayer)} fillOpacity={analytics ? '.65' : '.15'} fillRule="evenodd" stroke="#476648" strokeDasharray="6 3" strokeWidth={selected === block.id ? 4 : 1.5} onClick={() => { setSelectedField(0); onSelect?.(block.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedField(0); onSelect?.(block.id); } }}><title>{liveLabel(block, activeLayer)}</title></path>)}{rows && activeLayer === 'health' && disease?.features.map(feature => <polyline key={`${activeLayer}-${feature.properties.rowId}`} points={feature.geometry.coordinates.map(project).join(' ')} fill="none" stroke={(feature.properties.maxSeverity ?? 0) >= 3 ? '#eb7150' : '#65b55a'} strokeWidth="5"><title>Observaciones históricas · {feature.properties.rowCode}: {feature.properties.countObservations} observaciones</title></polyline>)}</g>;
  const renderLayer = (activeLayer: MapLayer, clipPath?: string) => demo ? renderDemoLayer(activeLayer, clipPath) : renderLiveLayer(activeLayer, clipPath);
  const activeValue = () => {
    if (!chosen) return { label: layerLabels[layer], value: 'Selecciona un bloque' };
    if (layer === 'moisture') return { label: 'Humedad del suelo', value: moistureLabel(analyticsByBlock.get(chosen.id)) };
    if (layer === 'nutrients') { const result = nutrientResult(analyticsByBlock.get(chosen.id)); return { label: nutrient, value: `${nutrientValue(analyticsByBlock.get(chosen.id)) ?? 'Sin dato'} ${result ? units[result.unit] : ''}` }; }
    if (layer === 'health') return { label: 'Estado sanitario', value: healthLabels[analyticsByBlock.get(chosen.id)?.healthStatus ?? 'NO_RECENT_INSPECTION'] };
    return { label: 'Área', value: `${chosen.areaHa ?? 'Sin dato'} ha` };
  };
  const currentValue = activeValue();
  const layerIsActive = (activeLayer: MapLayer) => layer === activeLayer || comparisonLayer === activeLayer;

  return <div className={`farm-map ${large ? 'map-large' : ''} ${expanded ? 'map-expanded' : ''} ${!demo ? 'map-live' : ''}`}>
    <svg viewBox="0 0 860 490" preserveAspectRatio={demo && !large ? 'xMidYMid slice' : 'xMidYMid meet'} className="map-canvas" aria-label={demo ? 'Mapa ilustrativo interactivo de los bloques de la finca' : 'Plano geográfico de campos, bloques y observaciones'} role="img">
      <defs><pattern id={`rows-${identifier}`} width="9" height="9" patternTransform="rotate(13)" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#365e29" fillOpacity=".2" /><path d="M2 0V9 M4 0V9" stroke="#b7d574" strokeWidth="1.5" strokeOpacity=".5" /></pattern><pattern id={`grid-${identifier}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#dfe8df" strokeWidth="1" /></pattern>{comparisonLayer && <><clipPath id={`${identifier}-left`}><rect x="0" y="0" width="430" height="490" /></clipPath><clipPath id={`${identifier}-right`}><rect x="430" y="0" width="430" height="490" /></clipPath></>}</defs>
      {demo ? <image href="/images/farm-aerial.png" width="860" height="490" preserveAspectRatio="xMidYMid slice" /> : <rect width="860" height="490" fill={`url(#grid-${identifier})`} />}
      {comparisonLayer ? <>{renderLayer(layer, `${identifier}-left`)}{renderLayer(comparisonLayer, `${identifier}-right`)}<rect x="428" y="0" width="4" height="490" fill="#ffffff" fillOpacity=".85" /><rect x="20" y="18" width="170" height="30" rx="7" fill="#ffffff" fillOpacity=".9" /><text x="33" y="38" fill="#294237" fontSize="12" fontWeight="700">{layerLabels[layer]}</text><rect x="670" y="18" width="170" height="30" rx="7" fill="#ffffff" fillOpacity=".9" /><text x="683" y="38" fill="#294237" fontSize="12" fontWeight="700">{layerLabels[comparisonLayer]}</text></> : renderLayer(layer)}
    </svg>
    {!large && demo && layer === 'health' && <div className="dashboard-map-overlay-legend"><strong>Leyenda</strong><span><i className="optimal" />Saludable</span><span><i className="attention" />Atención</span><span><i className="critical" />Crítico</span><span><i className="active" />Riego activo</span><span><i className="nodata" />Sin datos</span></div>}
    {large && comparisonLayer && <div className="map-compare-legend"><span><i style={{ background: layer === 'moisture' ? '#5386f5' : '#73b96b' }} />{layerLabels[layer]}</span><span><i style={{ background: comparisonLayer === 'moisture' ? '#5386f5' : '#73b96b' }} />{layerLabels[comparisonLayer]}</span></div>}
    {large && layersOpen && <div className="map-layer-panel map-information-panel"><div className="map-layer-panel-title"><strong>Capas de información</strong><button aria-label="Cerrar capas" className="icon-button" onClick={() => { setLayersOpen(false); onToolsChange?.(false); }}><X size={15} /></button></div><div className="map-layer-category-tabs"><button className={layer === 'satellite' || layer === 'health' ? 'active' : ''} type="button">Cultivo</button><button className={layer === 'moisture' || layer === 'nutrients' || comparisonLayer === 'moisture' || comparisonLayer === 'nutrients' ? 'active' : ''} type="button">Suelo</button><button type="button">Clima</button><button type="button">Operaciones</button></div><div className="map-layer-list"><label className="map-layer-row"><input type="checkbox" checked={boundaries} onChange={event => setBoundaries(event.target.checked)} /><span className="map-layer-row-icon"><Layers size={15} /></span><span>Límites de la finca</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked readOnly /><span className="map-layer-row-icon"><SquareStack size={15} /></span><span>Campos</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked readOnly /><span className="map-layer-row-icon"><SquareStack size={15} /></span><span>Bloques</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked={rows} onChange={event => setRows(event.target.checked)} /><span className="map-layer-row-icon"><Rows3 size={15} /></span><span>Filas de banano</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked={false} readOnly /><span className="map-layer-row-icon"><Sprout size={15} /></span><span>Plantas individuales</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked={layerIsActive('health')} onChange={() => onLayerChange?.('health')} /><span className="map-layer-row-icon"><Leaf size={15} /></span><span>Salud del cultivo</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked={layerIsActive('moisture')} onChange={() => onLayerChange?.('moisture')} /><span className="map-layer-row-icon"><Droplets size={15} /></span><span>Humedad del suelo</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked={layerIsActive('nutrients')} onChange={() => onLayerChange?.('nutrients')} /><span className="map-layer-row-icon"><FlaskConical size={15} /></span><span>Nutrientes del suelo</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked={false} readOnly /><span className="map-layer-row-icon"><Activity size={15} /></span><span>Índice de vegetación (NDVI)</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked={layerIsActive('health')} onChange={() => onLayerChange?.('health')} /><span className="map-layer-row-icon"><Bug size={15} /></span><span>Plagas y enfermedades</span><b>•••</b></label><label className="map-layer-row"><input type="checkbox" checked={false} readOnly /><span className="map-layer-row-icon"><ChartNoAxesCombined size={15} /></span><span>Producción</span><b>•••</b></label>{(layer === 'moisture' || comparisonLayer === 'moisture') && mapLegend('moisture')}{(layer === 'nutrients' || comparisonLayer === 'nutrients') && mapLegend('nutrients')}</div></div>}
    {!large && demo && <div className="map-caption"><Layers size={14} />Vista de la finca</div>}
    <div className="map-controls"><div><button aria-label="Acercar mapa" onClick={() => setZoom(value => Math.min(value + .2, 2.2))}><Plus size={18} /></button><button aria-label="Alejar mapa" onClick={() => setZoom(value => Math.max(value - .2, .8))}><Minus size={18} /></button></div><button aria-label="Centrar mapa" onClick={() => { setZoom(1); setSelectedField(0); onSelect?.(0); }}><LocateFixed size={18} /></button>{large && <button aria-label="Mostrar capas" onClick={() => { const nextOpen = !layersOpen; setLayersOpen(nextOpen); onToolsChange?.(nextOpen); }}><Layers size={18} /></button>}<button aria-label={expanded ? 'Salir de pantalla completa' : 'Ampliar mapa'} onClick={() => setExpanded(value => !value)}>{expanded ? <X size={18} /> : <Maximize size={17} />}</button></div>
    {chosen && demo && large && <div className="map-popup"><button className="icon-button" aria-label="Cerrar bloque" onClick={() => onSelect?.(0)}><X size={14} /></button><span className="eyebrow">BLOQUE SELECCIONADO</span><h3>{chosen.code}</h3><p>{chosen.field.name} · {chosen.areaHa} ha</p><div><span>{currentValue.label}</span><strong>{currentValue.value}</strong></div><span className="map-popup-note"><ArrowUpRight size={14} />Selecciona otro bloque para explorar</span></div>}
    {!demo && large && chosenField && <div className="map-popup"><button className="icon-button" aria-label="Cerrar campo" onClick={() => setSelectedField(0)}><X size={14} /></button><span className="eyebrow">CAMPO SELECCIONADO</span><h3>{chosenField.name}</h3><p>{chosenField.areaHa ?? 'Sin área'} ha · {chosenField.farm.name}</p><span className="map-popup-note">{chosenField.name.includes('[PRUEBA]') ? 'Plano de prueba · Ubicación y linderos aproximados' : 'Geometría registrada en el servidor'}</span></div>}
    {!demo && !coordinates.length && <div className="map-empty"><Layers size={28} /><strong>Sin geometrías registradas</strong><span>Los campos, bloques y surcos con observaciones aparecerán aquí.</span></div>}
    <div className="map-attribution">{demo ? 'Vista ilustrativa · No georreferenciada' : 'Plano geográfico · SRID 4326 · Sin mapa base'}</div>
    <div className="map-north"><span>N</span><Navigation size={22} fill="white" /></div>
  </div>;
}
