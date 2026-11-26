import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, LocateFixed, Maximize2, Rows3, Sprout, SquareStack, X } from 'lucide-react';
import type { AnalyticsLayer, Block, DiseaseLayer, Farm, Field, LineStringGeometry, PolygonGeometry, Row } from '../lib/types';
import { units } from '../lib/fertilization';
import { healthLabels } from '../lib/inspections';
import { healthMapColors, mapNutrientCodes, mapMoistureReading, moistureMapColor, moistureMapUnits, nutrientMapBand, nutrientMapColors, summarizeNutrientMap } from '../lib/map-analytics';
import type { FarmMapProps, MapLayer } from './FarmMap';

type BaseLayer = 'satellite' | 'hybrid' | 'map';

const layerLabels: Record<MapLayer, string> = {
  satellite: 'Vista de la finca',
  health: 'Salud del cultivo',
  moisture: 'Humedad del suelo',
  nutrients: 'Nutrientes del suelo',
};

const tileAttribution = '© OpenStreetMap contributors';
const satelliteAttribution = import.meta.env.VITE_MAP_SATELLITE_ATTRIBUTION || 'Esri, Maxar, Earthstar Geographics';
const mapFitPadding = 0.01;
const mapFitZoomBoost = 8;
type FilterValue = number | 'all';

function plantEstimate(row?: Row) {
  if (!validLine(row?.geom)) return 0;
  return Math.max(0, Math.round(row?.plantsEstimated ?? 0));
}

function plantPoints(rows: Row[], selectedPlant?: number): L.LatLngTuple[] {
  const points: L.LatLngTuple[] = [];
  rows.forEach(row => {
    const coordinates = row.geom?.coordinates;
    if (!coordinates?.length) return;
    const count = plantEstimate(row);
    if (!count) return;
    if (count === 1) {
      points.push([coordinates[0][1], coordinates[0][0]]);
      return;
    }
    const segments = coordinates.slice(1).map((coordinate, index) => {
      const previous = coordinates[index];
      const latitudeScale = Math.cos(((previous[1] + coordinate[1]) / 2) * Math.PI / 180);
      return Math.hypot((coordinate[0] - previous[0]) * latitudeScale, coordinate[1] - previous[1]);
    });
    const totalLength = segments.reduce((total, length) => total + length, 0);
    if (!totalLength) return;
    for (let index = 0; index < count; index += 1) {
      if (selectedPlant != null && index + 1 !== selectedPlant) continue;
      let target = totalLength * index / (count - 1);
      let segmentIndex = 0;
      while (segmentIndex < segments.length - 1 && target > segments[segmentIndex]) {
        target -= segments[segmentIndex];
        segmentIndex += 1;
      }
      const start = coordinates[segmentIndex];
      const end = coordinates[segmentIndex + 1];
      const ratio = segments[segmentIndex] ? target / segments[segmentIndex] : 0;
      points.push([start[1] + (end[1] - start[1]) * ratio, start[0] + (end[0] - start[0]) * ratio]);
    }
  });
  return points;
}

class PlantPointsLayer extends L.Layer {
  private map?: L.Map;
  private canvas?: HTMLCanvasElement;

  constructor(private readonly points: L.LatLngTuple[]) {
    super();
  }

  onAdd(map: L.Map) {
    this.map = map;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'real-map-plant-canvas';
    map.getPanes().overlayPane.appendChild(this.canvas);
    map.on('move zoom resize', this.redraw);
    this.redraw();
    return this;
  }

  onRemove(map: L.Map) {
    map.off('move zoom resize', this.redraw);
    this.canvas?.remove();
    this.canvas = undefined;
    this.map = undefined;
    return this;
  }

  private redraw = () => {
    const map = this.map;
    const canvas = this.canvas;
    if (!map || !canvas) return;
    const size = map.getSize();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size.x * pixelRatio;
    canvas.height = size.y * pixelRatio;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, size.x, size.y);
    if (map.getZoom() < 16) return;
    const visible = map.getBounds().pad(.2);
    const radius = map.getZoom() >= 19 ? 2.4 : 1.7;
    context.fillStyle = '#f3d45b';
    context.strokeStyle = '#6b541d';
    context.lineWidth = .65;
    this.points.forEach(([latitude, longitude]) => {
      if (!visible.contains([latitude, longitude])) return;
      const point = map.latLngToLayerPoint([latitude, longitude]).subtract(topLeft);
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    });
  };
}

function focusMap(map: L.Map, points: L.LatLngExpression[], animate = false) {
  if (!points.length) return;
  const bounds = L.latLngBounds(points);
  map.fitBounds(bounds.pad(mapFitPadding), { maxZoom: 21, animate });
  const zoom = map.getZoom();
  if (zoom > 0) map.setZoom(Math.min(zoom + mapFitZoomBoost, 21), { animate });
}

function polygonCoordinates(geometry: PolygonGeometry): L.LatLngExpression[][] {
  return geometry.coordinates.map(ring => ring.map(([longitude, latitude]) => [latitude, longitude] as L.LatLngTuple));
}

function lineCoordinates(geometry: LineStringGeometry): L.LatLngExpression[] {
  return geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude] as L.LatLngTuple);
}

function validPolygon(geometry?: PolygonGeometry): geometry is PolygonGeometry {
  return Boolean(geometry?.coordinates?.[0]?.length);
}

function validLine(geometry?: LineStringGeometry): geometry is LineStringGeometry {
  return Boolean(geometry?.coordinates?.length);
}

function makePathAccessible(path: L.Path, label: string) {
  const expose = () => {
    const element = path.getElement();
    if (!element) return;
    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', label);
  };
  expose();
  window.requestAnimationFrame(expose);
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] ?? character));
}

function nutrientResult(properties: AnalyticsLayer['features'][number]['properties'] | undefined, nutrient: string) {
  return properties?.soilAnalysis?.results.find(item => item.nutrient === mapNutrientCodes[nutrient]);
}

function blockColor(block: Block, layer: MapLayer, analytics: Map<number, AnalyticsLayer['features'][number]['properties']>, nutrient: string, nutrientRange: ReturnType<typeof summarizeNutrientMap>) {
  const properties = analytics.get(block.id);
  if (layer === 'satellite') return '#579359';
  if (!properties) return '#9eaea0';
  if (layer === 'health') return healthMapColors[properties.healthStatus ?? 'NO_RECENT_INSPECTION'];
  if (layer === 'moisture') return moistureMapColor(mapMoistureReading(properties).condition);
  const result = nutrientResult(properties, nutrient);
  return result && result.unit === nutrientRange.unit ? nutrientMapColors[nutrientMapBand(result.value, nutrientRange.min, nutrientRange.max)] : '#a9b5ae';
}

function blockLabel(block: Block, layer: MapLayer, analytics: Map<number, AnalyticsLayer['features'][number]['properties']>, nutrient: string) {
  const properties = analytics.get(block.id);
  const code = escapeHtml(block.code);
  if (!properties) return `${code} · ${block.areaHa ?? 'Sin área'} ha · Sin datos`;
  if (layer === 'health') return `${code} · ${healthLabels[properties.healthStatus ?? 'NO_RECENT_INSPECTION']}`;
  if (layer === 'moisture') {
    const reading = mapMoistureReading(properties);
    if (reading.sectorCount > 1) return `${code} · ${reading.sectorCount} sectores`;
    return `${code} · ${reading.value == null || !reading.unit ? 'Sin dato' : `${reading.value} ${moistureMapUnits[reading.unit]}`}`;
  }
  if (layer === 'nutrients') {
    const result = nutrientResult(properties, nutrient);
    return `${code} · ${escapeHtml(nutrient)}: ${result ? `${result.value} ${escapeHtml(units[result.unit])}` : 'Sin muestra'}`;
  }
  return `${code} · ${block.areaHa ?? properties.areaHa ?? 'Sin área'} ha`;
}

function popupForBlock(block: Block, field?: Field, detail?: string) {
  return `<div class="real-map-popup-content"><span class="real-map-popup-eyebrow">BLOQUE</span><strong>${escapeHtml(block.code)}</strong><span>${escapeHtml(field?.name ?? block.field.name)}</span>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}<dl><div><dt>Área</dt><dd>${escapeHtml(block.areaHa ?? 'Sin dato')} ${block.areaHa == null ? '' : 'ha'}</dd></div><div><dt>Cultivo</dt><dd>${escapeHtml(block.crop)}</dd></div><div><dt>Variedad</dt><dd>${escapeHtml(block.variety ?? 'Sin dato')}</dd></div></dl></div>`;
}

function createBaseLayer(mode: BaseLayer) {
  const satelliteUrl = import.meta.env.VITE_MAP_SATELLITE_TILES_URL || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const satellite = L.tileLayer(satelliteUrl, { maxZoom: 19, maxNativeZoom: 18, attribution: satelliteAttribution });
  if (mode === 'satellite') return satellite;
  if (mode === 'hybrid') {
    const labels = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, opacity: .65, attribution: tileAttribution });
    return L.layerGroup([satellite, labels]);
  }
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: tileAttribution });
}

const irrigationPointIcon = L.divIcon({ className: 'irrigation-map-point', iconSize: [19, 19], iconAnchor: [9, 9] });

export default function RealFarmMap({ blocks, farm, fields = [], rows = [], layer = 'satellite', comparisonLayer, nutrient = 'Nitrógeno (N)', large = false, selected, onSelect, onSelectField, blockPresentation, infrastructurePoints, legend, toolsOpen = false, onToolsChange, expandSignal, disease, analytics, baseLayer = 'map' }: FarmMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.Layer | null>(null);
  const overlaysRef = useRef<L.LayerGroup | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showFields, setShowFields] = useState(true);
  const [showBlocks, setShowBlocks] = useState(true);
  const [showRows, setShowRows] = useState(true);
  const [showPlants, setShowPlants] = useState(false);
  const [showFarmBoundary, setShowFarmBoundary] = useState(true);
  const [divisionFilter, setDivisionFilter] = useState<FilterValue>('all');
  const [blockFilter, setBlockFilter] = useState<FilterValue>('all');
  const [rowFilter, setRowFilter] = useState<FilterValue>('all');
  const [plantFilter, setPlantFilter] = useState<FilterValue>('all');
  const [selectedField, setSelectedField] = useState<Field>();

  const analyticsByBlock = useMemo(() => new Map((analytics?.features ?? []).map(feature => [feature.properties.blockId, feature.properties])), [analytics]);
  const nutrientRange = useMemo(() => summarizeNutrientMap(blocks.map(block => nutrientResult(analyticsByBlock.get(block.id), nutrient))), [analyticsByBlock, blocks, nutrient]);
  const filterBlocks = useMemo(() => blocks.filter(block => divisionFilter === 'all' || block.field.id === divisionFilter), [blocks, divisionFilter]);
  const visibleFields = useMemo(() => fields.filter(field => divisionFilter === 'all' || field.id === divisionFilter), [fields, divisionFilter]);
  const visibleBlocks = useMemo(() => filterBlocks.filter(block => blockFilter === 'all' || block.id === blockFilter), [filterBlocks, blockFilter]);
  const filterRows = useMemo(() => {
    const ids = new Set(visibleBlocks.map(block => block.id));
    return rows.filter(row => ids.has(row.block.id));
  }, [visibleBlocks, rows]);
  const visibleRows = useMemo(() => filterRows.filter(row => rowFilter === 'all' || row.id === rowFilter), [filterRows, rowFilter]);
  const visibleDisease = useMemo(() => {
    const ids = new Set(visibleRows.map(row => row.id));
    return disease?.features.filter(feature => ids.has(feature.properties.rowId));
  }, [disease, visibleRows]);
  const selectedRow = rowFilter === 'all' ? undefined : visibleRows.find(row => row.id === rowFilter);
  const selectedPlantCount = plantEstimate(selectedRow);
  const selectedPlant = plantFilter === 'all' || plantFilter > selectedPlantCount ? undefined : plantFilter;
  const filterActive = divisionFilter !== 'all' || blockFilter !== 'all' || rowFilter !== 'all' || plantFilter !== 'all';

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: false, minZoom: 2, maxZoom: 21 });
    L.control.zoom({ position: blockPresentation ? 'topleft' : 'topright' }).addTo(map);
    map.getPane('overlayPane')?.classList.add('map-canvas');
    map.setView([4.5709, -74.2973], 6);
    mapRef.current = map;
    overlaysRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      baseRef.current = null;
      overlaysRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (baseRef.current) map.removeLayer(baseRef.current);
    baseRef.current = createBaseLayer(baseLayer).addTo(map);
  }, [baseLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngExpression[] = [];
    if (!filterActive) farm?.geom?.coordinates.flat().forEach(([longitude, latitude]) => points.push([latitude, longitude]));
    visibleFields.forEach(field => field.geom?.coordinates.flat().forEach(([longitude, latitude]) => points.push([latitude, longitude])));
    visibleBlocks.forEach(block => block.geom?.coordinates.flat().forEach(([longitude, latitude]) => points.push([latitude, longitude])));
    visibleRows.forEach(row => row.geom?.coordinates.forEach(([longitude, latitude]) => points.push([latitude, longitude])));
    visibleDisease?.forEach(feature => feature.geometry.coordinates.forEach(([longitude, latitude]) => points.push([latitude, longitude])));
    focusMap(map, points.length ? points : (infrastructurePoints ?? []).map(point => [point.latitude, point.longitude]));
  }, [blocks, blockFilter, disease, divisionFilter, farm, fields, filterActive, infrastructurePoints, rowFilter, rows, visibleBlocks, visibleDisease, visibleFields, visibleRows]);

  useEffect(() => {
    const map = mapRef.current;
    const geometry = blocks.find(block => block.id === selected)?.geom;
    if (map && validPolygon(geometry)) focusMap(map, polygonCoordinates(geometry).flat(), true);
  }, [blocks, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(timer);
  }, [expanded, large]);

  useEffect(() => {
    if (expandSignal) setExpanded(value => !value);
  }, [expandSignal]);

  useEffect(() => {
    const map = mapRef.current;
    const overlays = overlaysRef.current;
    if (!map || !overlays) return;
    overlays.clearLayers();

    const fieldById = new Map(fields.map(field => [field.id, field]));
    const farmLayer = L.layerGroup();
    const fieldLayer = L.layerGroup();
    const blockLayer = L.layerGroup();
    const rowLayer = L.layerGroup();
    const diseaseLayer = L.layerGroup();

    const farmGeometry = farm?.geom;
    if (showFarmBoundary && validPolygon(farmGeometry)) {
      const polygon = L.polygon(polygonCoordinates(farmGeometry), { color: '#0f7b52', fillColor: '#6eb88a', fillOpacity: .08, weight: 3, dashArray: '12 6' });
      polygon.bindTooltip(`${escapeHtml(farm?.name)} · Límite aproximado`, { sticky: true, className: 'real-map-tooltip' });
      polygon.addTo(farmLayer);
    }

    if (showFields) visibleFields.forEach((field, index) => {
      const geometry = field.geom;
      if (!validPolygon(geometry)) return;
      const polygon = L.polygon(polygonCoordinates(geometry), { color: ['#326c4a', '#568a43', '#3c7792', '#6e7d41'][index % 4], fillColor: '#9ecb8b', fillOpacity: .12, weight: 2.5, dashArray: '8 5' });
      polygon.bindTooltip(`${escapeHtml(field.name)} · ${field.areaHa ?? 'Sin área'} ha`, { sticky: true, className: 'real-map-tooltip' });
      const activateField = () => { setSelectedField(field); onSelect?.(0); onSelectField?.(field.id); };
      polygon.on('click', activateField);
      polygon.on('keydown', event => { if (event.originalEvent.key === 'Enter' || event.originalEvent.key === ' ') { event.originalEvent.preventDefault(); activateField(); } });
      polygon.addTo(fieldLayer);
      makePathAccessible(polygon, `Seleccionar campo ${field.name}`);
    });

    if (showBlocks) visibleBlocks.forEach(block => {
      const geometry = block.geom;
      if (!validPolygon(geometry)) return;
      const isSelected = selected === block.id;
      const presentation = blockPresentation?.get(block.id);
      const polygon = L.polygon(polygonCoordinates(geometry), { color: isSelected || presentation ? '#ffffff' : '#294f35', fillColor: presentation?.color ?? blockColor(block, layer, analyticsByBlock, nutrient, nutrientRange), fillOpacity: presentation ? .58 : blockPresentation ? .1 : layer === 'satellite' ? .24 : .62, weight: isSelected ? 4 : 1.6, opacity: .95 });
      polygon.bindTooltip(presentation ? `${escapeHtml(presentation.label ?? block.code)} · ${escapeHtml(presentation.detail)}` : blockLabel(block, layer, analyticsByBlock, nutrient), { sticky: true, className: 'real-map-tooltip' });
      polygon.bindPopup(popupForBlock(block, fieldById.get(block.field.id), presentation?.detail), { className: 'real-map-popup', maxWidth: 260 });
      polygon.on('click', () => { setSelectedField(undefined); onSelect?.(block.id); onSelectField?.(block.field.id); });
      polygon.addTo(blockLayer);
      makePathAccessible(polygon, `Seleccionar ${block.code}`);
    });

    if (showRows) visibleRows.forEach(row => {
      const geometry = row.geom;
      if (!validLine(geometry)) return;
      const line = L.polyline(lineCoordinates(geometry), { color: '#dceebd', opacity: .8, weight: 2.5 });
      line.bindTooltip(`${escapeHtml(row.rowCode)} · ${escapeHtml(row.block.code)}`, { sticky: true, className: 'real-map-tooltip' });
      line.on('click', () => onSelect?.(row.block.id));
      line.addTo(rowLayer);
    });

    if (showRows) visibleDisease?.forEach(feature => {
      const severity = feature.properties.maxSeverity ?? 0;
      const line = L.polyline(lineCoordinates(feature.geometry), { color: severity >= 3 ? '#e34f45' : '#e7ae42', opacity: .95, weight: 4.5 });
      line.bindTooltip(`${escapeHtml(feature.properties.rowCode)} · ${feature.properties.countObservations} observaciones`, { sticky: true, className: 'real-map-tooltip' });
      line.addTo(diseaseLayer);
    });

    if (showFarmBoundary) farmLayer.addTo(overlays);
    if (showFields) fieldLayer.addTo(overlays);
    if (showBlocks) blockLayer.addTo(overlays);
    if (showRows) rowLayer.addTo(overlays);
    if (showRows) diseaseLayer.addTo(overlays);
    if (showPlants) {
      const points = plantPoints(visibleRows, selectedPlant);
      if (points.length) overlays.addLayer(new PlantPointsLayer(points));
    }
    infrastructurePoints?.forEach(point => {
      const marker = L.marker([point.latitude, point.longitude], {
        icon: irrigationPointIcon,
        title: point.label,
      }).bindPopup(escapeHtml(point.label)).addTo(overlays);
      marker.getElement()?.setAttribute('aria-label', point.label);
    });
  }, [analyticsByBlock, blocks, blockFilter, blockPresentation, disease, divisionFilter, farm, fields, infrastructurePoints, layer, nutrient, nutrientRange, onSelect, onSelectField, plantFilter, rowFilter, rows, selected, selectedPlant, showBlocks, showFarmBoundary, showFields, showPlants, showRows, visibleBlocks, visibleDisease, visibleFields, visibleRows]);

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    setSelectedField(undefined);
    const points: L.LatLngExpression[] = [];
    if (!filterActive) farm?.geom?.coordinates.flat().forEach(([longitude, latitude]) => points.push([latitude, longitude]));
    visibleFields.forEach(field => field.geom?.coordinates.flat().forEach(([longitude, latitude]) => points.push([latitude, longitude])));
    visibleBlocks.forEach(block => block.geom?.coordinates.flat().forEach(([longitude, latitude]) => points.push([latitude, longitude])));
    visibleRows.forEach(row => row.geom?.coordinates.forEach(([longitude, latitude]) => points.push([latitude, longitude])));
    if (!points.length) infrastructurePoints?.forEach(point => points.push([point.latitude, point.longitude]));
    if (points.length) focusMap(map, points, true);
    else map.setView([4.5709, -74.2973], 6);
  };

  const noGeometry = !infrastructurePoints?.length && !validPolygon(farm?.geom) && !fields.some(field => validPolygon(field.geom)) && !blocks.some(block => validPolygon(block.geom)) && !rows.some(row => validLine(row.geom));

  return <div className={`farm-map real-map ${large ? 'map-large' : ''} ${expanded ? 'map-expanded' : ''} ${noGeometry ? 'real-map-empty' : ''}`}>
    <div ref={containerRef} className="real-map-canvas" aria-label="Mapa geográfico interactivo de la finca" />
    {legend}
    <div className="real-map-actions">
      <button type="button" aria-label="Centrar mapa" title="Centrar mapa" onClick={resetView}><LocateFixed size={16} /></button>
      <button type="button" aria-label={expanded ? 'Salir de pantalla completa' : 'Ampliar mapa'} title={expanded ? 'Salir de pantalla completa' : 'Ampliar mapa'} onClick={() => setExpanded(value => !value)}>{expanded ? <X size={16} /> : <Maximize2 size={16} />}</button>
    </div>
    {large && toolsOpen && <div className="real-map-layer-panel">
      <div className="real-map-layer-heading"><strong>Capas del mapa</strong><button type="button" aria-label="Cerrar capas" onClick={() => onToolsChange?.(false)}><X size={15} /></button></div>
      <div className="real-map-filter-heading"><strong>Filtrar ubicación</strong><button type="button" className="real-map-filter-reset" onClick={() => { setDivisionFilter('all'); setBlockFilter('all'); setRowFilter('all'); setPlantFilter('all'); }}>Limpiar</button></div>
      <label className="real-map-filter"><span>División</span><select aria-label="Filtrar por división" value={divisionFilter} onChange={event => { const value: FilterValue = event.target.value === 'all' ? 'all' : Number(event.target.value); setDivisionFilter(value); setBlockFilter('all'); setRowFilter('all'); setPlantFilter('all'); }}><option value="all">Todas</option>{fields.map(field => <option key={field.id} value={field.id}>{field.name}</option>)}</select></label>
      <label className="real-map-filter"><span>Bloque</span><select aria-label="Filtrar por bloque" value={blockFilter} onChange={event => { const value: FilterValue = event.target.value === 'all' ? 'all' : Number(event.target.value); setBlockFilter(value); setRowFilter('all'); setPlantFilter('all'); }}><option value="all">Todos</option>{filterBlocks.map(block => <option key={block.id} value={block.id}>{block.code}</option>)}</select></label>
      <label className="real-map-filter"><span>Surco</span><select aria-label="Filtrar por surco" value={rowFilter} onChange={event => { const value: FilterValue = event.target.value === 'all' ? 'all' : Number(event.target.value); setRowFilter(value); setPlantFilter('all'); }}><option value="all">Todos</option>{filterRows.map(row => <option key={row.id} value={row.id}>{row.rowCode}</option>)}</select></label>
      <label className="real-map-filter"><span>Planta</span><select aria-label="Filtrar por planta" value={selectedPlant ?? 'all'} disabled={!selectedPlantCount} onChange={event => { setShowPlants(true); setPlantFilter(event.target.value === 'all' ? 'all' : Number(event.target.value)); }}><option value="all">Todas</option>{Array.from({ length: selectedPlantCount }, (_, index) => <option key={index + 1} value={index + 1}>Planta {index + 1}</option>)}</select></label>
      <label><input type="checkbox" checked={showFarmBoundary} onChange={event => setShowFarmBoundary(event.target.checked)} /><Layers size={15} />Límite de la finca</label>
      <label><input type="checkbox" checked={showFields} onChange={event => setShowFields(event.target.checked)} /><SquareStack size={15} />Divisiones / campos</label>
      <label><input type="checkbox" checked={showBlocks} onChange={event => setShowBlocks(event.target.checked)} /><SquareStack size={15} />Bloques</label>
      <label><input type="checkbox" checked={showRows} onChange={event => setShowRows(event.target.checked)} /><Rows3 size={15} />Filas y observaciones</label>
      <label><input type="checkbox" checked={showPlants} onChange={event => { setShowPlants(event.target.checked); if (!event.target.checked) setPlantFilter('all'); }} /><Sprout size={15} />Posiciones estimadas de plantas</label>
      <div className="real-map-layer-current"><Layers size={14} /><span>Capa activa</span><strong>{layerLabels[layer]}</strong></div>
      {comparisonLayer && <div className="real-map-layer-current"><span>Comparando</span><strong>{layerLabels[comparisonLayer]}</strong></div>}
    </div>}
    {selectedField && <div className="map-popup real-map-field-popup"><button className="icon-button" aria-label="Cerrar campo" onClick={() => setSelectedField(undefined)}><X size={14} /></button><span className="eyebrow">CAMPO SELECCIONADO</span><h3>{selectedField.name}</h3><p>{selectedField.areaHa ?? 'Sin área'} ha · {selectedField.farm.name}</p><span className="map-popup-note">{selectedField.name.includes('[PRUEBA]') ? 'Plano de prueba · Ubicación y linderos aproximados' : 'Geometría registrada en el servidor'}</span></div>}
    {noGeometry && <div className="real-map-empty-message"><Layers size={26} /><strong>Sin geometrías registradas</strong><span>Agrega coordenadas reales a tus campos y bloques para ubicarlos sobre el mapa.</span></div>}
    <div className="map-attribution">{baseLayer === 'map' ? tileAttribution : satelliteAttribution} · SRID 4326</div>
    <div className="map-north"><span>N</span></div>
  </div>;
}

