import { useEffect, useId, useState } from 'react';
import { Plus, Minus, LocateFixed, Layers, Maximize, Navigation, X, Rows3, Sprout, Droplets, Radio, Satellite, SquareStack } from 'lucide-react';
import type { Block, Field } from '../lib/types';

const fieldPlots = [
  { points: '218,126 300,47 466,66 505,193 210,249', label: [355, 137], divider: 'M345 52L381 217', angle: -12 },
  { points: '505,193 631,156 703,246 750,350 537,410 445,353 425,207', label: [571, 266], divider: 'M459 361L677 215', angle: -18 },
  { points: '210,249 425,207 445,353 341,422 188,363', label: [317, 319], divider: 'M273 237L288 402', angle: 10 },
  { points: '537,410 750,350 785,451 570,467', label: [658, 414], divider: 'M668 373L701 455', angle: -10 },
];
export const fieldMapColors = ['#42a95d', '#f0b928', '#347fd8', '#ed5147'];

type Props = {
  fields: Field[];
  fieldOrder: number[];
  blocks: Block[];
  selectedFieldId: number;
  onSelectField: (id: number) => void;
  layersOpen: boolean;
  onLayersChange: (open: boolean) => void;
};

export default function FieldOverviewMap({ fields, fieldOrder, blocks, selectedFieldId, onSelectField, layersOpen, onLayersChange }: Props) {
  const [zoom, setZoom] = useState(1);
  const [boundaries, setBoundaries] = useState(true);
  const [fieldsVisible, setFieldsVisible] = useState(true);
  const [blocksVisible, setBlocksVisible] = useState(true);
  const [rowsVisible, setRowsVisible] = useState(true);
  const [plantsVisible, setPlantsVisible] = useState(false);
  const [irrigationVisible, setIrrigationVisible] = useState(false);
  const [sensorsVisible, setSensorsVisible] = useState(false);
  const [satelliteVisible, setSatelliteVisible] = useState(true);
  const [category, setCategory] = useState<'crop' | 'infrastructure'>('crop');
  const [expanded, setExpanded] = useState(false);
  const identifier = useId().replaceAll(':', '');
  const plots = fields.flatMap(field => {
    const index = fieldOrder.indexOf(field.id);
    return fieldPlots[index] ? [{ field, index, plot: fieldPlots[index] }] : [];
  });
  const cropLayers = [
    { label: 'Límites de los campos', icon: Layers, checked: boundaries, set: setBoundaries },
    { label: 'Campos', icon: SquareStack, checked: fieldsVisible, set: setFieldsVisible },
    { label: 'División de bloques', icon: SquareStack, checked: blocksVisible, set: setBlocksVisible },
    { label: 'Filas de banano', icon: Rows3, checked: rowsVisible, set: setRowsVisible },
    { label: 'Plantas individuales', icon: Sprout, checked: plantsVisible, set: setPlantsVisible },
  ];
  const infrastructureLayers = [
    { label: 'Tuberías de ejemplo', icon: Droplets, checked: irrigationVisible, set: setIrrigationVisible },
    { label: 'Sensores de ejemplo', icon: Radio, checked: sensorsVisible, set: setSensorsVisible },
  ];
  const layers = [...(category === 'crop' ? cropLayers : infrastructureLayers), { label: 'Imagen aérea', icon: Satellite, checked: satelliteVisible, set: setSatelliteVisible }];

  useEffect(() => {
    if (!expanded) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [expanded]);

  return <div className={'farm-map fields-overview-map ' + (expanded ? 'map-expanded' : '')}>
    <svg viewBox="0 0 860 490" className="map-canvas" role="img" aria-label="Mapa ilustrativo de campos de la finca">
      <defs>
        {fieldPlots.map(({ angle }, index) => <pattern key={index} id={identifier + '-rows-' + index} width="9" height="9" patternTransform={'rotate(' + angle + ')'} patternUnits="userSpaceOnUse">
          <path d="M2 0V9" stroke="#fff8d4" strokeWidth="1.3" strokeOpacity=".50" /><path d="M6 0V9" stroke="#12340d" strokeWidth="1.2" strokeOpacity=".44" />
        </pattern>)}
        <pattern id={identifier + '-plants'} width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.6" fill="#f8ffe2" fillOpacity=".85" /><circle cx="13" cy="13" r="1.6" fill="#f8ffe2" fillOpacity=".85" /></pattern>
      </defs>
      {satelliteVisible ? <image href="/images/farm-aerial.png" width="860" height="490" preserveAspectRatio="xMidYMid slice" /> : <rect width="860" height="490" fill="#dcebdc" />}
      <g style={{ transform: 'translate(430px, 245px) scale(' + zoom + ') translate(-430px, -245px)', transition: 'transform .25s ease' }}>
        {plots.map(({ field, index, plot }) => {
          const [x, y] = plot.label;
          const labelWidth = Math.max(93, field.name.length * 6 + 14);
          const children = blocks.filter(block => block.field.id === field.id);
          return <g key={field.id} className="fields-map-plot" role="button" tabIndex={0} aria-label={'Seleccionar ' + field.name}
            onClick={() => onSelectField(field.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectField(field.id); } }}>
            <polygon points={plot.points} fill={fieldsVisible ? fieldMapColors[index] : 'transparent'} fillOpacity=".72"
              stroke={boundaries ? '#fffdf0' : 'transparent'} strokeWidth={selectedFieldId === field.id ? 4 : 2.5} />
            {rowsVisible && <polygon points={plot.points} fill={'url(#' + identifier + '-rows-' + index + ')'} />}
            {plantsVisible && <polygon points={plot.points} fill={'url(#' + identifier + '-plants)'} />}
            {blocksVisible && children.length > 1 && <path d={plot.divider} stroke="#fffdf0" strokeWidth="1.6" fill="none" />}
            {fieldsVisible && <g className="fields-plot-label">
              <rect x={x - labelWidth / 2} y={y - 21} width={labelWidth} height="42" rx="6" fill="#fff" fillOpacity=".89" />
              <text x={x} y={y - 3} textAnchor="middle" fill="#203449" fontSize="12" fontWeight="700">{field.name}</text>
              <text x={x} y={y + 13} textAnchor="middle" fill="#43513f" fontSize="11">{field.areaHa ?? '—'} ha</text>
            </g>}
          </g>;
        })}
        {irrigationVisible && <g className="fields-map-irrigation"><path d="M65 218 C240 190 355 240 474 220 S680 185 812 215" /><path d="M130 404 C300 365 455 398 650 355" /></g>}
        {sensorsVisible && <g className="fields-map-sensors">{plots.map(({ field, plot }) => <circle key={field.id} cx={plot.label[0] + 52} cy={plot.label[1] + 30} r="7" aria-label={'Sensor de ejemplo de ' + field.name} />)}</g>}
      </g>
    </svg>
    {layersOpen && <div className="map-layer-panel fields-map-layer-panel">
      <div className="fields-map-layer-heading"><strong>Capas del mapa</strong><button className="icon-button" aria-label="Cerrar capas" onClick={() => onLayersChange(false)}><X size={15} /></button></div>
      <div className="fields-map-layer-tabs">
        <button type="button" aria-pressed={category === 'crop'} className={category === 'crop' ? 'active' : ''} onClick={() => setCategory('crop')}>Cultivo</button>
        <button type="button" aria-pressed={category === 'infrastructure'} className={category === 'infrastructure' ? 'active' : ''} onClick={() => setCategory('infrastructure')}>Infraestructura</button>
      </div>
      <div className="fields-map-layer-list">{layers.map(layer => <label className="fields-map-layer-row" key={layer.label}>
        <input type="checkbox" checked={layer.checked} onChange={event => layer.set(event.target.checked)} />
        <span className="fields-map-layer-icon"><layer.icon size={15} /></span><span>{layer.label}</span>
      </label>)}</div>
    </div>}
    <div className="fields-map-controls">
      <div><button aria-label="Acercar mapa" onClick={() => setZoom(value => Math.min(value + .2, 2.2))}><Plus size={18} /></button>
        <button aria-label="Alejar mapa" onClick={() => setZoom(value => Math.max(value - .2, .8))}><Minus size={18} /></button></div>
      <button aria-label="Centrar mapa" onClick={() => setZoom(1)}><LocateFixed size={18} /></button>
      <button aria-label="Mostrar capas" aria-expanded={layersOpen} onClick={() => onLayersChange(!layersOpen)}><Layers size={18} /></button>
      <button aria-label={expanded ? 'Salir de pantalla completa' : 'Ampliar mapa'} onClick={() => setExpanded(value => !value)}>{expanded ? <X size={18} /> : <Maximize size={18} />}</button>
    </div>
    <div className="map-attribution">Vista ilustrativa · Sin escala geográfica</div>
    <div className="fields-map-north"><span>N</span><Navigation size={22} fill="white" /></div>
  </div>;
}
