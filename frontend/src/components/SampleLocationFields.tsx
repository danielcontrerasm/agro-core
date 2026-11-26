import { useEffect, useId, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Block } from '../lib/types';
import './sample-location.css';

interface SamplePoint {
  latitude: number;
  longitude: number;
}

function SamplePointMap({ block, point, onSelect }: { block?: Block; point?: SamplePoint; onSelect?: (point: SamplePoint) => void }) {
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const outline = useRef<L.Polygon | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const polygon = block?.geom;
  const latitude = point?.latitude;
  const longitude = point?.longitude;

  useEffect(() => {
    if (!canvas.current) return;
    const instance = L.map(canvas.current, {
      maxZoom: 19, scrollWheelZoom: false, attributionControl: false,
    }).setView([0, 0], 2);
    map.current = instance;
    return () => { instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    outline.current?.remove();
    outline.current = null;
    if (polygon?.coordinates[0]?.length) {
      const rings = polygon.coordinates.map(ring => ring.map(([lng, lat]) => L.latLng(lat, lng)));
      outline.current = L.polygon(rings, { color: '#187651', fillColor: '#70bc92', fillOpacity: .24 }).addTo(instance);
      instance.fitBounds(outline.current.getBounds(), { padding: [24, 24], maxZoom: 17 });
    }
  }, [polygon]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    marker.current?.remove();
    marker.current = null;
    if (latitude == null || longitude == null) return;
    const location = L.latLng(latitude, longitude);
    marker.current = L.circleMarker(location, { radius: 7, color: 'white', weight: 2, fillColor: '#0e5940', fillOpacity: 1 })
      .bindTooltip('Punto de toma de la muestra').addTo(instance);
    const bounds = outline.current?.getBounds();
    if (bounds) instance.fitBounds(bounds.extend(location), { padding: [24, 24], maxZoom: 17 });
    else instance.setView(location, 16);
  }, [latitude, longitude, polygon]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !onSelect) return;
    const select = ({ latlng }: L.LeafletMouseEvent) => onSelect({ latitude: latlng.lat, longitude: latlng.wrap().lng });
    instance.on('click', select);
    return () => { instance.off('click', select); };
  }, [onSelect]);

  return <div className={`sample-location-map${onSelect ? ' sample-location-map-selectable' : ''}`}
    ref={canvas} role="region" aria-label={onSelect ? 'Seleccionar el punto de toma de la muestra en el mapa' : 'Mapa del punto de toma de la muestra'} />;
}

function samplePoint(latitude: string, longitude: string): SamplePoint | undefined {
  if (!latitude || !longitude) return undefined;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { latitude: lat, longitude: lng };
}

export function SampleLocationMap({ latitude, longitude, block }: { latitude?: number | null; longitude?: number | null; block?: Block }) {
  if (latitude == null || longitude == null) return null;
  const point = samplePoint(String(latitude), String(longitude));
  return point ? <SamplePointMap block={block} point={point} /> : null;
}

export default function SampleLocationFields({ block }: { block?: Block }) {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number>();
  const [error, setError] = useState('');
  const request = useRef(0);
  const guidance = useId();
  const point = samplePoint(latitude, longitude);
  useEffect(() => () => { request.current += 1; }, []);

  function resetPositionStatus() {
    request.current += 1;
    setLocating(false);
    setAccuracy(undefined);
    setError('');
  }

  function selectLocation(selected: SamplePoint) {
    resetPositionStatus();
    setLatitude(selected.latitude.toFixed(6));
    setLongitude(selected.longitude.toFixed(6));
  }

  function locate() {
    setError('');
    if (!navigator.geolocation) {
      setError('Este navegador no permite consultar la ubicación. Ingresa las coordenadas.');
      return;
    }
    const current = ++request.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      if (current !== request.current) return;
      selectLocation(position.coords);
      setAccuracy(Math.round(position.coords.accuracy));
    }, failure => {
      if (current !== request.current) return;
      setLocating(false);
      setError(failure.code === 1 ? 'El navegador no concedió acceso a la ubicación. Ingresa las coordenadas.'
        : 'No se pudo obtener la ubicación. Vuelve a intentarlo o ingresa las coordenadas.');
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 });
  }

  return <div className="full-span sample-location-fields">
    <div className="sample-location-coordinates">
      <label>Latitud (opcional)<input name="latitude" type="number" min={-90} max={90} step="any"
        value={latitude} onChange={event => { resetPositionStatus(); setLatitude(event.target.value); }} /></label>
      <label>Longitud (opcional)<input name="longitude" type="number" min={-180} max={180} step="any"
        value={longitude} onChange={event => { resetPositionStatus(); setLongitude(event.target.value); }} /></label>
    </div>
    <div className="sample-location-actions">
      <button className="button secondary small" type="button" disabled={locating} aria-describedby={guidance} onClick={locate}>
        <LocateFixed size={16} />{locating ? 'Consultando ubicación…' : 'Usar ubicación actual'}
      </button>
      {(latitude || longitude) && <button className="text-button" type="button" onClick={() => {
        resetPositionStatus(); setLatitude(''); setLongitude('');
      }}>Quitar ubicación</button>}
    </div>
    <p className="muted" id={guidance}>{block?.geom ? 'Marca en el mapa el lugar donde tomaste la muestra o ingresa sus coordenadas.'
      : 'Usa la ubicación del dispositivo cuando estés en el lugar donde tomaste la muestra.'}</p>
    {accuracy != null && <p role="status">Precisión aproximada del dispositivo: {accuracy} m.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {(block?.geom || point) && <SamplePointMap block={block} point={point} onSelect={block?.geom ? selectLocation : undefined} />}
  </div>;
}
