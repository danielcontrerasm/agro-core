import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Plus, Minus, LocateFixed, Layers, Maximize, Navigation, X, Ruler, Rows3, Sprout, Droplets, Radio, Satellite, Waves, SquareStack, MoreHorizontal } from 'lucide-react';
import type { Block, Field } from '../lib/types';

const fieldPlots = [
  { points: '175,74 420,36 462,190 205,231', center: [315, 139] },
  { points: '462,190 690,113 752,270 510,307', center: [606, 218] },
  { points: '92,247 350,224 386,408 118,431', center: [238, 331] },
  { points: '385,318 647,290 712,445 427,457', center: [548, 374] },
];
const fieldColors = ['#42a95d', '#f0b928', '#347fd8', '#ed5147'];

export default function FieldOverviewMap({ fields, blocks, selectedFieldId, onSelectField, layersOpen = true, onLayersChange }: { fields: Field[]; blocks: Block[]; selectedFieldId: number; onSelectField: (id: number) => void; layersOpen?: boolean; onLayersChange?: (open: boolean) => void }) {
  const [zoom, setZoom] = useState(1);
  const [boundaries, setBoundaries] = useState(true);
  const [fieldsVisible, setFieldsVisible] = useState(true);
  const [blocksVisible, setBlocksVisible] = useState(true);
  const [rowsVisible, setRowsVisible] = useState(true);
  const [plantsVisible, setPlantsVisible] = useState(false);
  const [irrigationVisible, setIrrigationVisible] = useState(false);
  const [sensorsVisible, setSensorsVisible] = useState(false);
  const [satelliteVisible, setSatelliteVisible] = useState(true);
  const [contoursVisible, setContoursVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const identifier = useId().replaceAll(':', '');
  const visibleFields = fields.slice(0, fieldPlots.length);
  const fieldName = (field: Field, index: number) => field.name || `Campo ${String.fromCharCode(65 + index)}`;
  const fieldBlocks = (field: Field) => blocks.filter(block => block.field.id === field.id);
  const toggleLayers = () => onLayersChange?.(!layersOpen);
  const layerRow = (label: string, icon: ReactNode, checked: boolean, onChange: (value: boolean) => void, disabled = false) => <label className="fields-map-layer-row"><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span className="fields-map-layer-icon">{icon}</span><span>{label}</span><MoreHorizontal size={14} /></label>;

  return <div className={`farm-map fields-overview-map ${expanded ? 'map-expanded' : ''}`}>
    <svg viewBox="0 0 860 490" className="map-canvas" role="img" aria-label="Mapa de campos de la finca">
      <defs><pattern id={`field-rows-${identifier}`} width="9" height="9" patternTransform="rotate(11)" patternUnits="userSpaceOnUse"><path d="M2 0V9 M5 0V9" stroke="#f2f8d9" strokeWidth="1.8" strokeOpacity=".75" /></pattern><pattern id={`field-plants-${identifier}`} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.6" fill="#f8ffe2" fillOpacity=".85" /><circle cx="13" cy="13" r="1.6" fill="#f8ffe2" fillOpacity=".85" /></pattern></defs>
      {satelliteVisible ? <image href="/images/farm-aerial.png" width="860" height="490" preserveAspectRatio="xMidYMid slice" /> : <rect width="860" height="490" fill="#dcebdc" />}
      {contoursVisible && <g fill="none" stroke="#ffffff" strokeOpacity=".38" strokeWidth="2"><ellipse cx="330" cy="190" rx="190" ry="110" /><ellipse cx="330" cy="190" rx="220" ry="135" /><ellipse cx="540" cy="330" rx="175" ry="85" /><ellipse cx="540" cy="330" rx="210" ry="108" /></g>}
      <g style={{ transform: `translate(430px, 245px) scale(${zoom}) translate(-430px, -245px)`, transition: 'transform .25s ease' }}>
        {visibleFields.map((field, index) => {
          const plot = fieldPlots[index];
          const selected = selectedFieldId === field.id;
          const children = fieldBlocks(field);
          return <g key={field.id} className="fields-map-plot" role="button" tabIndex={0} aria-label={`Seleccionar ${fieldName(field, index)}`} onClick={() => onSelectField(field.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectField(field.id); } }}>
            {fieldsVisible && <><polygon points={plot.points} fill={fieldColors[index % fieldColors.length]} fillOpacity=".78" stroke={boundaries ? '#fff' : 'transparent'} strokeWidth={selected ? 5 : 3} />{rowsVisible && <polygon points={plot.points} fill={`url(#field-rows-${identifier})`} />}{plantsVisible && <polygon points={plot.points} fill={`url(#field-plants-${identifier})`} />}</>}
            {blocksVisible && <g className="fields-map-block-lines" opacity=".72"><line x1={plot.center[0] - 65} y1={plot.center[1] + 33} x2={plot.center[0] + 70} y2={plot.center[1] + 13} /><line x1={plot.center[0] - 74} y1={plot.center[1] + 48} x2={plot.center[0] + 62} y2={plot.center[1] + 28} /><text x={plot.center[0]} y={plot.center[1] + 67} textAnchor="middle">{children.length} bloques</text></g>}
            {fieldsVisible && <><rect x={plot.center[0] - 54} y={plot.center[1] - 26} width="108" height="49" rx="7" fill="#f8fff0" fillOpacity=".92" /><text x={plot.center[0]} y={plot.center[1] - 4} textAnchor="middle" fill="#20372a" fontSize="13" fontWeight="700">{fieldName(field, index)}</text><text x={plot.center[0]} y={plot.center[1] + 14} textAnchor="middle" fill="#43513f" fontSize="10">{field.areaHa ?? '—'} ha</text></>}
          </g>;
        })}
        {irrigationVisible && <g className="fields-map-irrigation"><path d="M65 218 C240 190 355 240 474 220 S680 185 812 215" /><path d="M130 404 C300 365 455 398 650 355" /></g>}
        {sensorsVisible && <g className="fields-map-sensors">{visibleFields.map((field, index) => <circle key={field.id} cx={fieldPlots[index].center[0] + 52} cy={fieldPlots[index].center[1] + 30} r="7" aria-label={`Sensor de ${fieldName(field, index)}`} />)}</g>}
      </g>
      <g className="fields-map-scale"><path d="M22 452H118 M22 447V457 M70 447V457 M118 447V457" /><text x="22" y="440">0</text><text x="66" y="440">500</text><text x="108" y="440">1,000 m</text></g>
    </svg>
    {layersOpen && <div className="map-layer-panel fields-map-layer-panel"><div className="fields-map-layer-heading"><strong>Capas del mapa</strong><button className="icon-button" aria-label="Cerrar capas" onClick={toggleLayers}><X size={15} /></button></div><div className="fields-map-layer-tabs"><button className="active" type="button">Cultivo</button><button type="button">Suelo</button><button type="button">Clima</button><button type="button">Infraestructura</button></div><div className="fields-map-layer-list">{layerRow('Límites de la finca', <Layers size={15} />, boundaries, setBoundaries)}{layerRow('Campos', <SquareStack size={15} />, fieldsVisible, setFieldsVisible)}{layerRow('Bloques', <SquareStack size={15} />, blocksVisible, setBlocksVisible)}{layerRow('Filas de banano', <Rows3 size={15} />, rowsVisible, setRowsVisible)}{layerRow('Plantas individuales', <Sprout size={15} />, plantsVisible, setPlantsVisible)}{layerRow('Riego (tuberías y válvulas)', <Droplets size={15} />, irrigationVisible, setIrrigationVisible)}{layerRow('Sensores', <Radio size={15} />, sensorsVisible, setSensorsVisible)}{layerRow('Imágenes satelitales', <Satellite size={15} />, satelliteVisible, setSatelliteVisible)}{layerRow('Curvas de nivel', <Waves size={15} />, contoursVisible, setContoursVisible)}</div></div>}
    <div className="fields-map-controls"><div><button aria-label="Acercar mapa" onClick={() => setZoom(value => Math.min(value + .2, 2.2))}><Plus size={18} /></button><button aria-label="Alejar mapa" onClick={() => setZoom(value => Math.max(value - .2, .8))}><Minus size={18} /></button></div><button aria-label="Centrar mapa" onClick={() => setZoom(1)}><LocateFixed size={18} /></button><button aria-label="Mostrar capas" onClick={toggleLayers}><Layers size={18} /></button><button aria-label="Medir distancia"><Ruler size={18} /></button><button aria-label={expanded ? 'Salir de pantalla completa' : 'Ampliar mapa'} onClick={() => setExpanded(value => !value)}>{expanded ? <X size={18} /> : <Maximize size={18} />}</button></div>
    <div className="fields-map-north"><span>N</span><Navigation size={22} fill="white" /></div>
  </div>;
}
