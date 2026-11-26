import { useEffect, useId, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Plus, Minus, LocateFixed, Layers, Maximize, Navigation, X, ArrowUpRight, SquareStack, Rows3, Leaf, Droplets, FlaskConical, CircleCheck, TriangleAlert } from 'lucide-react';
import { blockHealth } from '../lib/demo';
import { moistureLabels } from '../lib/irrigation';
import { interpretNutrient, units } from '../lib/fertilization';
import { mapNutrientCodes, mapMoistureReading, moistureMapBands, moistureMapColor, moistureMapUnits, nutrientMapBand, nutrientMapColors, summarizeNutrientMap } from '../lib/map-analytics';
import type { AnalyticsLayer, Block, DiseaseLayer, Farm, Field, PolygonGeometry, Row } from '../lib/types';
import { healthLabels } from '../lib/inspections';
import RealFarmMap from './RealFarmMap';

export type MapLayer = 'satellite' | 'health' | 'moisture' | 'nutrients';
export type BlockPresentation = { color: string; detail: string; label?: string; indicator?: 'check' | 'alert' };
export type MapPoint = { latitude: number; longitude: number; label: string };
export interface FarmMapProps {
  blocks: Block[];
  farm?: Farm;
  fields?: Field[];
  rows?: Row[];
  layer?: MapLayer;
  comparisonLayer?: MapLayer;
  nutrient?: string;
  large?: boolean;
  selected?: number;
  onSelect?: (id: number) => void;
  onSelectField?: (id: number) => void;
  onInspectBlock?: () => void;
  blockPresentation?: ReadonlyMap<number, BlockPresentation>;
  irrigationNetwork?: boolean;
  infrastructurePoints?: MapPoint[];
  legend?: ReactNode;
  onLayerChange?: (layer: MapLayer) => void;
  toolsOpen?: boolean;
  onToolsChange?: (open: boolean) => void;
  expandSignal?: number;
  demo?: boolean;
  disease?: DiseaseLayer;
  analytics?: AnalyticsLayer;
  baseLayer?: 'satellite' | 'hybrid' | 'map';
}
const plots = [
  { points: '80,70 410,32 454,230 90,275', center: [260, 150] },
  { points: '410,32 700,83 760,255 454,230', center: [585, 145] },
  { points: '454,230 760,255 680,433 355,401', center: [560, 315] },
  { points: '90,275 454,230 355,401 62,350', center: [220, 315] },
  { points: '760,255 825,320 720,450 680,433', center: [730, 350] },
];
const singlePlot = [{ points: '176,111 681,85 720,383 120,340', center: [420, 233] }];
// Positions follow the crop rows and access paths in the illustrative aerial image.
const aerialPlots = [
  { points: '106,142 124,113 206,26 353,22 370,33 366,86 332,149 334,160 301,166 249,164 170,151', center: [236, 98] },
  { points: '346,153 344,136 377,67 384,47 437,51 655,86 680,109 689,137 632,148 533,168 395,169 365,166', center: [518, 112] },
  { points: '542,174 688,145 710,168 734,211 740,246 726,270 685,291 576,295 565,263', center: [634, 225] },
  { points: '104,147 176,156 255,170 333,170 343,181 326,252 310,286 277,290 155,259 83,219 70,198 80,167', center: [206, 219] },
  { points: '353,179 389,173 527,174 542,187 556,258 568,294 371,298 328,290 334,237', center: [445, 238] },
];
const irrigationMain = 'M82 252 L147 264 L316 295 L365 298 L571 303 L687 301 L738 282';
const irrigationBranches = 'M316 295 L336 221 L348 170 L333 160 L373 58 M348 170 L406 173 L537 172 L690 141 M537 172 L550 215 L560 264 L571 303 M147 264 L100 239 L71 203';
const junctions = [[82, 252], [316, 295], [348, 170], [537, 172], [571, 303], [738, 282]];
const tones = { satellite: ['#77ae43', '#9cba35', '#5fa247', '#76a440', '#7cb746'], health: ['#62b65d', '#e7c441', '#5db36a', '#eb7150', '#89ba55'], moisture: ['#46a8ef', '#efb744', '#65b67a', '#ef7450', '#76b750'], nutrients: ['#e3bd43', '#ed8548', '#53b772', '#ed6e44', '#89b857'] };
const demoHealthLabels = [
  { title: 'Campo A', detail: '52 ha', color: '#4eaf5c' },
  { title: 'Bajo K', detail: 'A3 · 14 ha', color: '#efc335' },
  { title: 'Sigatoka', detail: 'B2 · 18 ha', color: '#e45248' },
  { title: 'Riego activo', detail: 'C1 · 20 ha', color: '#3c87e8' },
  { title: 'Humedad baja', detail: 'D1 · 16 ha', color: '#ef8b2d' },
];
const layerLabels: Record<MapLayer, string> = { satellite: 'Vista de la finca', health: 'Salud del cultivo', moisture: 'Humedad del suelo', nutrients: 'Nutrientes del suelo' };

function IllustratedFarmMap({ blocks, fields = [], layer = 'satellite', comparisonLayer, nutrient = 'Nitrógeno (N)', large = false, selected, onSelect, onInspectBlock, blockPresentation, irrigationNetwork, legend, onLayerChange, toolsOpen, onToolsChange, expandSignal, demo = true, disease, analytics, baseLayer = 'satellite' }: FarmMapProps) {
  const [zoom, setZoom] = useState(1);
  const [layersOpen, setLayersOpen] = useState(large);
  const [boundaries, setBoundaries] = useState(true);
  const [rows, setRows] = useState(true);
  const [blocksVisible, setBlocksVisible] = useState(true);
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
  const mapHeight = blockPresentation ? 350 : 490;
  const demoPlots = blockPresentation ? aerialPlots : blocks.length === 1 ? singlePlot : plots;
  const demoTransform = 'translate(430px, ' + mapHeight / 2 + 'px) scale(' + zoom + ') translate(-430px, -' + mapHeight / 2 + 'px)';
  const demoZoomStyle = { transform: demoTransform, transition: 'transform .25s ease' };
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
  const nutrientResult = (properties?: AnalyticsLayer['features'][number]['properties']) => properties?.soilAnalysis?.results.find(result => result.nutrient === mapNutrientCodes[nutrient]);
  const nutrientRange = summarizeNutrientMap(blocks.map(block => nutrientResult(analyticsByBlock.get(block.id))));
  const moistureLabel = (properties?: AnalyticsLayer['features'][number]['properties']) => {
    const reading = mapMoistureReading(properties);
    if (reading.sectorCount > 1) return reading.sectorCount + ' sectores';
    if (reading.value == null) return 'Sin dato';
    const unit = reading.unit ? moistureMapUnits[reading.unit] : '%';
    const condition = reading.condition ? moistureLabels[reading.condition as keyof typeof moistureLabels] ?? reading.condition : 'Sin condición';
    return `${reading.value} ${unit} · ${condition}`;
  };
  const liveColor = (block: Block, activeLayer: MapLayer) => {
    const properties = analyticsByBlock.get(block.id);
    if (activeLayer === 'satellite') return '#579359';
    if (!properties) return '#b5c2ae';
    if (activeLayer === 'moisture') return moistureMapColor(mapMoistureReading(properties).condition);
    if (activeLayer === 'health') return properties.healthStatus === 'ACTIVE_FINDINGS' ? '#eb7150' : properties.healthStatus === 'NO_ACTIVE_FINDINGS' ? '#62b65d' : '#b5c2ae';
    const result = nutrientResult(properties);
    return result && result.unit === nutrientRange.unit ? nutrientMapColors[nutrientMapBand(result.value, nutrientRange.min, nutrientRange.max)] : '#a9b5ae';
  };
  const liveLabel = (block: Block, activeLayer = layer) => {
    const properties = analyticsByBlock.get(block.id);
    if (!properties) return `${block.code}: sin datos`;
    if (activeLayer === 'moisture') return `${block.code}: ${moistureLabel(properties)}`;
    if (activeLayer === 'health') return `${block.code}: ${healthLabels[properties.healthStatus ?? 'NO_RECENT_INSPECTION']}`;
    if (activeLayer === 'nutrients') { const result = nutrientResult(properties); const interpretation = result ? interpretNutrient(result, properties.crop, properties.soilAnalysis?.sampleType ?? 'SOIL') : undefined; return `${block.code}: ${nutrient} ${result?.value ?? 'sin dato'} ${result ? units[result.unit] : ''} · ${interpretation?.label ?? 'Sin interpretar'} · ${properties.soilAnalysis?.sampledOn ?? 'Sin muestra'}`; }
    return `${block.code}: ${properties.areaHa ?? block.areaHa ?? 'sin dato'} ha`;
  };
  const moistureLegend = <div className="map-layer-inline-legend">
    <strong>Condición registrada</strong>
    {moistureMapBands.map(band => <span key={band.status}><i style={{ background: band.color }} />{band.label}</span>)}
  </div>;
  const renderDemoLayer = (activeLayer: MapLayer, clipPath?: string) => <g clipPath={clipPath ? `url(#${clipPath})` : undefined} style={demoZoomStyle}>{blocksVisible && demoPlots.map((plot, plotIndex) => {
    const block = blocks[plotIndex];
    if (!block) return null;
    const properties = analyticsByBlock.get(block.id);
    const presentation = blockPresentation?.get(block.id);
    const demoLabel = activeLayer === 'health' ? demoHealthLabels[plotIndex] : undefined;
    const thematic = activeLayer === 'moisture' || activeLayer === 'nutrients';
    const fill = presentation?.color ?? demoLabel?.color ?? (activeLayer === 'satellite' ? tones.satellite[plotIndex] : liveColor(block, activeLayer));
    const reading = mapMoistureReading(properties);
    const result = nutrientResult(properties);
    const detail = presentation?.detail ?? demoLabel?.detail ?? (activeLayer === 'moisture' && reading.value != null
      ? `${reading.value} ${reading.unit ? moistureMapUnits[reading.unit] : '%'}`
      : activeLayer === 'moisture' && reading.sectorCount > 1 ? reading.sectorCount + ' sectores'
      : activeLayer === 'nutrients' && result ? `${result.value} ${units[result.unit]}`
      : `${block.areaHa ?? '—'} ha`);
    const label = presentation?.label ?? demoLabel?.title ?? block.code;
    const labelWidth = Math.max(86, Math.max(label.length, detail.length) * 6 + 18);
    const [x, y] = plot.center;
    const gradient = `plot-${identifier}-${activeLayer}-${block.id}-${clipPath ?? 'single'}`;
    return <g key={`${activeLayer}-${block.id}`} className="map-plot" role="button" tabIndex={0} aria-label={`Seleccionar ${block.code}`}
      onClick={() => onSelect?.(block.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(block.id); } }}>
      <title>{presentation || demoLabel ? `${label} · ${detail}` : liveLabel(block, activeLayer)}</title>
      {thematic && <defs>
        <radialGradient id={gradient} cx={plotIndex % 2 === 0 ? '.33' : '.65'} cy=".4" r=".75">
          <stop offset="0" stopColor={fill} stopOpacity=".94" />
          <stop offset=".55" stopColor={fill} stopOpacity=".82" />
          <stop offset="1" stopColor={fill} stopOpacity=".40" />
        </radialGradient>
      </defs>}
      <polygon points={plot.points} fill={thematic ? `url(#${gradient})` : fill}
        fillOpacity={thematic ? 1 : presentation ? .55 : demoLabel ? .72 : blockPresentation ? .08 : .36}
        stroke={boundaries ? '#fffce9' : 'transparent'} strokeOpacity={blockPresentation && !presentation ? .45 : 1}
        strokeWidth={selected === block.id ? 4 : blockPresentation ? 1.7 : 2.3} vectorEffect={blockPresentation ? 'non-scaling-stroke' : undefined} />
      {rows && !blockPresentation && <polygon points={plot.points} fill={`url(#rows-${identifier})`} opacity={thematic ? .68 : 1} />}
      {!blockPresentation && <>
        {activeLayer === 'moisture' && reading.value != null && <g transform={`translate(${x + labelWidth / 2 + 13}, ${y + 16})`}>
          <circle r="8" fill="#2368da" stroke="white" strokeWidth="2" />
          <path d="M0-4C-2-1-3 0-3 2A3 3 0 0 0 3 2C3 0 2-1 0-4Z" fill="white" />
        </g>}
        <g className="map-plot-label">
          <rect x={x - labelWidth / 2} y={y - 21} width={labelWidth} height="42" rx="6" fill="#fff" fillOpacity=".90" />
          {demoLabel && <circle cx={x - labelWidth / 2 + 11} cy={y - 5} r="5" fill={demoLabel.color} />}
          <text x={x + (demoLabel ? 5 : 0)} y={y - 3} textAnchor="middle" fill="#152637" fontSize="12" fontWeight="700">{label}</text>
          <text x={x} y={y + 13} textAnchor="middle" fill="#384755" fontSize="10">{detail}</text>
        </g>
      </>}
    </g>;
  })}{irrigationNetwork && blocksVisible && <g aria-hidden="true" pointerEvents="none" fill="none" strokeLinejoin="round" strokeLinecap="round">
    <path d={`${irrigationMain} ${irrigationBranches}`} stroke="#072949" strokeWidth="5" vectorEffect="non-scaling-stroke" opacity=".62" />
    <path d={irrigationMain} stroke="#449cff" strokeWidth="3" vectorEffect="non-scaling-stroke" />
    <path d={irrigationBranches} stroke="#81caff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    {junctions.map(([x, y], index) => <g transform={`translate(${x},${y})`} key={x}>
      <circle r={index === 0 ? 12 : 8} fill={index === 0 ? '#2077eb' : '#133357'} stroke="#e8f6ff" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      <path d={index === 0 ? 'M-5 5V-3H5V5Z M-3-3V-6H3V-3 M-3 2H3' : 'M-4 0H4 M0-4V4'} stroke="white" strokeWidth="1.5" />
    </g>)}
  </g>}</g>;
  const renderLiveLayer = (activeLayer: MapLayer, clipPath?: string) => <g clipPath={clipPath ? `url(#${clipPath})` : undefined} style={{ transform: `translate(430px, 245px) scale(${zoom}) translate(-430px, -245px)`, transition: 'transform .25s ease' }}>{mappedFields.map((field, fieldIndex) => {
    const [labelX, labelY] = labelPosition(field.geom!);
    return <g key={`${activeLayer}-field-${field.id}`} className="map-plot" role="button" tabIndex={0} aria-label={`Seleccionar campo ${field.name}`} onClick={() => { setSelectedField(field.id); onSelect?.(0); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedField(field.id); onSelect?.(0); } }}><path d={polygonPath(field.geom!)} fill={tones.satellite[fieldIndex % tones.satellite.length]} fillOpacity={activeLayer === 'satellite' ? '.3' : '.12'} fillRule="evenodd" stroke="#366c42" strokeWidth={selectedField === field.id ? 4 : 2} /><title>{field.name}: {field.areaHa ?? 'Sin área'} ha</title><text x={labelX} y={labelY - 3} textAnchor="middle" fill="#23382a" fontSize="12" fontWeight="700" pointerEvents="none">{field.name.replace(' [PRUEBA]', '')}</text><text x={labelX} y={labelY + 15} textAnchor="middle" fill="#43513f" fontSize="11" pointerEvents="none">{field.areaHa ?? '—'} ha</text></g>;
  })}{mappedBlocks.map(block => <path key={`${activeLayer}-block-${block.id}`} className="map-plot" role="button" tabIndex={0} aria-label={`Seleccionar ${block.code}`} d={polygonPath(block.geom!)} fill={liveColor(block, activeLayer)} fillOpacity={analytics ? '.65' : '.15'} fillRule="evenodd" stroke="#476648" strokeDasharray="6 3" strokeWidth={selected === block.id ? 4 : 1.5} onClick={() => { setSelectedField(0); onSelect?.(block.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedField(0); onSelect?.(block.id); } }}><title>{liveLabel(block, activeLayer)}</title></path>)}{rows && activeLayer === 'health' && disease?.features.map(feature => <polyline key={`${activeLayer}-${feature.properties.rowId}`} points={feature.geometry.coordinates.map(project).join(' ')} fill="none" stroke={(feature.properties.maxSeverity ?? 0) >= 3 ? '#eb7150' : '#65b55a'} strokeWidth="5"><title>Observaciones históricas · {feature.properties.rowCode}: {feature.properties.countObservations} observaciones</title></polyline>)}</g>;
  const renderLayer = (activeLayer: MapLayer, clipPath?: string) => demo ? renderDemoLayer(activeLayer, clipPath) : renderLiveLayer(activeLayer, clipPath);
  const activeValue = () => {
    if (!chosen) return { label: layerLabels[layer], value: 'Selecciona un bloque' };
    if (layer === 'moisture') return { label: 'Humedad del suelo', value: moistureLabel(analyticsByBlock.get(chosen.id)) };
    if (layer === 'nutrients') { const result = nutrientResult(analyticsByBlock.get(chosen.id)); return { label: nutrient, value: result ? `${result.value} ${units[result.unit]}` : 'Sin muestra' }; }
    if (layer === 'health') return { label: 'Estado sanitario', value: healthLabels[analyticsByBlock.get(chosen.id)?.healthStatus ?? 'NO_RECENT_INSPECTION'] };
    return { label: 'Área', value: `${chosen.areaHa ?? 'Sin dato'} ha` };
  };
  const currentValue = activeValue();
  const layerIsActive = (activeLayer: MapLayer) => layer === activeLayer || comparisonLayer === activeLayer;

  return <div className={`farm-map ${large ? 'map-large' : ''} ${expanded ? 'map-expanded' : ''} ${!demo ? 'map-live' : ''}`}>
    <svg viewBox={'0 0 860 ' + mapHeight} preserveAspectRatio={demo && (large || blockPresentation) ? 'none' : 'xMidYMid slice'} className="map-canvas" aria-label={demo ? 'Mapa ilustrativo interactivo de los bloques de la finca' : 'Plano geográfico de campos, bloques y observaciones'} role={blockPresentation ? 'group' : 'img'}>
      <defs><pattern id={`rows-${identifier}`} width="9" height="9" patternTransform="rotate(13)" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#365e29" fillOpacity=".2" /><path d="M2 0V9 M4 0V9" stroke="#b7d574" strokeWidth="1.5" strokeOpacity=".5" /></pattern><pattern id={`grid-${identifier}`} width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#dfe8df" strokeWidth="1" /></pattern>{comparisonLayer && <><clipPath id={`${identifier}-left`}><rect x="0" y="0" width="430" height="490" /></clipPath><clipPath id={`${identifier}-right`}><rect x="430" y="0" width="430" height="490" /></clipPath></>}</defs>
      {demo && baseLayer !== 'map' ? <image href="/images/farm-aerial.png" width="860" height={mapHeight} preserveAspectRatio={blockPresentation ? 'none' : 'xMidYMid slice'} style={blockPresentation ? demoZoomStyle : undefined} /> : <rect width="860" height="490" fill="#dce9dc" />}
      {demo && baseLayer === 'map' && <rect width="860" height="490" fill={`url(#grid-${identifier})`} />}
      {comparisonLayer ? <>{renderLayer(layer, `${identifier}-left`)}{renderLayer(comparisonLayer, `${identifier}-right`)}<rect x="428" y="0" width="4" height="490" fill="#ffffff" fillOpacity=".85" /><rect x="20" y="18" width="170" height="30" rx="7" fill="#ffffff" fillOpacity=".9" /><text x="33" y="38" fill="#294237" fontSize="12" fontWeight="700">{layerLabels[layer]}</text><rect x="670" y="18" width="170" height="30" rx="7" fill="#ffffff" fillOpacity=".9" /><text x="683" y="38" fill="#294237" fontSize="12" fontWeight="700">{layerLabels[comparisonLayer]}</text></> : renderLayer(layer)}
    </svg>
    {blockPresentation && demoPlots.map(({ center: [x, y] }, index) => {
      const block = blocks[index];
      const presentation = block && blockPresentation.get(block.id);
      if (!presentation || !blocksVisible) return null;
      return <div className={`farm-map-block-label${selected === block.id ? ' selected' : ''}`} key={block.id} aria-hidden="true"
        style={{ left: `${50 + (x / 860 * 100 - 50) * zoom}%`, top: `${50 + (y / mapHeight * 100 - 50) * zoom}%`, '--block-color': presentation.color } as CSSProperties}>
        {presentation.indicator === 'check' && <CircleCheck size={17} />}
        {presentation.indicator === 'alert' && <TriangleAlert size={17} />}
        <div><strong>{presentation.label ?? block.code}</strong><small>{presentation.detail}</small></div>
      </div>;
    })}
    {legend}
    {!large && demo && layer === 'health' && <div className="dashboard-map-overlay-legend"><strong>Leyenda</strong><span><i className="optimal" />Saludable</span><span><i className="attention" />Atención</span><span><i className="critical" />Crítico</span><span><i className="active" />Riego activo</span><span><i className="nodata" />Sin datos</span></div>}
    {large && comparisonLayer && <div className="map-compare-legend"><span><i style={{ background: layer === 'moisture' ? '#5386f5' : '#73b96b' }} />{layerLabels[layer]}</span><span><i style={{ background: comparisonLayer === 'moisture' ? '#5386f5' : '#73b96b' }} />{layerLabels[comparisonLayer]}</span></div>}
    {large && layersOpen && <div className="map-layer-panel map-information-panel">
      <div className="map-layer-panel-title">
        <strong>Capas del mapa</strong>
        <button aria-label="Cerrar capas" className="icon-button" onClick={() => { setLayersOpen(false); onToolsChange?.(false); }}><X size={15} /></button>
      </div>
      <div className="map-layer-list">
        <label className="map-layer-row"><input type="checkbox" checked={boundaries} onChange={event => setBoundaries(event.target.checked)} /><Layers size={15} /><span>Límites de los bloques</span></label>
        <label className="map-layer-row"><input type="checkbox" checked={blocksVisible} onChange={event => setBlocksVisible(event.target.checked)} /><SquareStack size={15} /><span>Bloques</span></label>
        <label className="map-layer-row"><input type="checkbox" checked={rows} onChange={event => setRows(event.target.checked)} /><Rows3 size={15} /><span>Filas de banano</span></label>
        {([
          ['health', Leaf], ['moisture', Droplets], ['nutrients', FlaskConical],
        ] as const).map(([item, Icon]) => <label className="map-layer-row" key={item}>
          <input type="checkbox" checked={layerIsActive(item)} onChange={() => onLayerChange?.(layerIsActive(item) ? 'satellite' : item)} />
          <Icon size={15} /><span>{layerLabels[item]}</span>
        </label>)}
        {layer === 'moisture' && !comparisonLayer && moistureLegend}
      </div>
    </div>}

    {!large && demo && <div className="map-caption"><Layers size={14} />Vista de la finca</div>}
    <div className="map-controls"><div><button aria-label="Acercar mapa" onClick={() => setZoom(value => Math.min(value + .2, 2.2))}><Plus size={18} /></button><button aria-label="Alejar mapa" onClick={() => setZoom(value => Math.max(value - .2, blockPresentation ? 1 : .8))}><Minus size={18} /></button></div><button aria-label="Centrar mapa" onClick={() => { setZoom(1); setSelectedField(0); onSelect?.(0); }}><LocateFixed size={18} /></button>{large && <button aria-label="Mostrar capas" onClick={() => { const nextOpen = !layersOpen; setLayersOpen(nextOpen); onToolsChange?.(nextOpen); }}><Layers size={18} /></button>}<button aria-label={expanded ? 'Salir de pantalla completa' : 'Ampliar mapa'} onClick={() => setExpanded(value => !value)}>{expanded ? <X size={18} /> : <Maximize size={17} />}</button></div>
    {chosen && demo && large && <div className="map-popup">
      <button className="icon-button" aria-label="Cerrar bloque" onClick={() => onSelect?.(0)}><X size={14} /></button>
      <span className="eyebrow">{layer === 'moisture' ? 'LECTURA DEL BLOQUE' : layer === 'nutrients' ? 'MUESTRA DE SUELO' : 'BLOQUE SELECCIONADO'}</span>
      <h3>{chosen.code}</h3>
      <p>{chosen.field.name} · {chosen.areaHa ?? '—'} ha</p>
      <div><span>{currentValue.label}</span><strong>{currentValue.value}</strong></div>
      {onInspectBlock && <button className="button small full-width" onClick={onInspectBlock}>Ver detalles <ArrowUpRight size={14} /></button>}
    </div>}

    {!demo && large && chosenField && <div className="map-popup"><button className="icon-button" aria-label="Cerrar campo" onClick={() => setSelectedField(0)}><X size={14} /></button><span className="eyebrow">CAMPO SELECCIONADO</span><h3>{chosenField.name}</h3><p>{chosenField.areaHa ?? 'Sin área'} ha · {chosenField.farm.name}</p><span className="map-popup-note">{chosenField.name.includes('[PRUEBA]') ? 'Plano de prueba · Ubicación y linderos aproximados' : 'Geometría registrada en el servidor'}</span></div>}
    {!demo && !coordinates.length && <div className="map-empty"><Layers size={28} /><strong>Sin geometrías registradas</strong><span>Los campos, bloques y surcos con observaciones aparecerán aquí.</span></div>}
    <div className="map-attribution">{demo ? 'Vista ilustrativa · No georreferenciada' : 'Plano geográfico · SRID 4326 · Sin mapa base'}</div>
    <div className="map-north"><span>N</span><Navigation size={22} fill="white" /></div>
  </div>;
}

export default function FarmMap(props: FarmMapProps) {
  return props.demo === false ? <RealFarmMap {...props} /> : <IllustratedFarmMap {...props} />;
}
