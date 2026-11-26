import type { ReactNode } from 'react';
import { CalendarDays, Droplets, MapPin } from 'lucide-react';
import { number } from '../lib/domain';
import { moistureLabels, moistureUnits } from '../lib/irrigation';
import type { IrrigationExecution, IrrigationMeasurement, IrrigationPlan, IrrigationSector } from '../lib/irrigation';
import PhotoGallery from './PhotoGallery';
import { Badge } from './ui';

type RecordItem = IrrigationExecution | IrrigationPlan | IrrigationSector;

const recordedDate = (value?: string) => value ? new Date(value).toLocaleString('es-CO', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}) : 'Sin fecha';

function Quantity({ value, unit }: { value?: number; unit: string }) {
  return value == null ? 'Sin dato' : `${number(value, 6)} ${unit}`;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="irrigation-detail-section"><h3>{title}</h3><dl>{children}</dl></section>;
}

function DetailValue({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return <div className={wide ? 'irrigation-detail-wide' : undefined}><dt>{label}</dt><dd>{children}</dd></div>;
}

function Reading({ reading }: { reading?: IrrigationMeasurement }) {
  if (!reading) return 'Sin medición registrada';
  return <>
    <Quantity value={reading.value} unit={moistureUnits[reading.unit]} /> · {reading.depthCm} cm
    <small>{recordedDate(reading.recordedAt)} · {reading.source === 'SENSOR' ? 'Sensor' : 'Manual'}</small>
  </>;
}

function SectorDetails({ sector, blockName, snapshot }: {
  sector: IrrigationSector;
  blockName: (id: number) => string;
  snapshot?: boolean;
}) {
  return <>
    <DetailSection title={snapshot ? 'Configuración al programar' : 'Configuración del sector'}>
      <DetailValue label="Bloque">{blockName(sector.blockId)}</DetailValue>
      <DetailValue label="Área"><Quantity value={sector.areaHa} unit="ha" /></DetailValue>
      <DetailValue label="Sistema de riego">{sector.system}</DetailValue>
      <DetailValue label="Fuente de agua">{sector.waterSource}</DetailValue>
      <DetailValue label="Unidad de humedad">{moistureUnits[sector.unit]}</DetailValue>
      <DetailValue label="Profundidad"><Quantity value={sector.depthCm} unit="cm" /></DetailValue>
      <DetailValue label="Vigencia de lecturas"><Quantity value={sector.maxAgeHours} unit="h" /></DetailValue>
      <DetailValue label="Rango técnico">{sector.lowerBound == null || sector.upperBound == null
        ? 'Sin configurar'
        : `${number(sector.lowerBound, 3)} a ${number(sector.upperBound, 3)} ${moistureUnits[sector.unit]}`}</DetailValue>
      {!snapshot && <DetailValue label="Fundamento técnico" wide>{sector.technicalBasis || 'Sin fundamento registrado'}</DetailValue>}
    </DetailSection>
    <DetailSection title={snapshot ? 'Lectura al programar' : 'Última lectura de humedad'}>
      <DetailValue label="Humedad"><Reading reading={sector.latest ?? undefined} /></DetailValue>
      <DetailValue label="Estado">{moistureLabels[sector.condition]}</DetailValue>
      <DetailValue label="Lluvia registrada"><Quantity value={sector.latest?.rainMm} unit="mm" /></DetailValue>
      <DetailValue label="Drenaje">{sector.latest?.drainage || 'Sin observación'}</DetailValue>
    </DetailSection>
  </>;
}

export default function IrrigationDetails({ detail, plans, measurements, sectorName, blockName, memberName, onPhotoBusy }: {
  detail: RecordItem;
  plans: IrrigationPlan[];
  measurements: IrrigationMeasurement[];
  sectorName: (id: number) => string;
  blockName: (id: number) => string;
  memberName: (id: number) => string;
  onPhotoBusy: (busy: boolean) => void;
}) {
  if ('eventId' in detail) {
    const plan = plans.find(item => item.id === detail.planId);
    const readings = measurements.filter(reading => reading.sectorId === plan?.sectorId)
      .sort((first, second) => Date.parse(first.recordedAt) - Date.parse(second.recordedAt));
    const before = readings.filter(reading => Date.parse(reading.recordedAt) <= Date.parse(detail.startedAt)).at(-1);
    const after = readings.find(reading => Date.parse(reading.recordedAt) >= Date.parse(detail.endedAt));
    const metered = detail.volumeMode === 'METER';
    const meterUnit = detail.meterUnit === 'L' ? 'L' : 'm³';
    return <>
      <div className="farm-work-context">
        <span className="farm-work-context-icon"><Droplets size={24} /></span>
        <div>
          <strong>{plan ? sectorName(plan.sectorId) : 'Ejecución de riego'}</strong>
          <small>Programación #{detail.planId}</small>
          <p>{number(detail.volumeM3, 6)} m³ · {metered ? 'Medido por contador' : 'Estimado por caudal'} · {number(detail.durationMinutes, 6)} min efectivos</p>
        </div>
        <Badge tone="blue">Registrada</Badge>
      </div>
      <DetailSection title="Tiempo y volumen">
        <DetailValue label="Inicio real">{recordedDate(detail.startedAt)}</DetailValue>
        <DetailValue label="Fin real">{recordedDate(detail.endedAt)}</DetailValue>
        <DetailValue label="Interrupciones"><Quantity value={detail.interruptionMinutes} unit="min" /></DetailValue>
        <DetailValue label="Operador">{memberName(detail.createdBy)}</DetailValue>
        {metered ? <>
          <DetailValue label="Lectura inicial del contador"><Quantity value={detail.meterStart} unit={meterUnit} /></DetailValue>
          <DetailValue label="Lectura final del contador"><Quantity value={detail.meterEnd} unit={meterUnit} /></DetailValue>
        </> : <DetailValue label="Caudal utilizado"><Quantity value={detail.flowM3h} unit="m³/h" /></DetailValue>}
      </DetailSection>
      <DetailSection title="Observaciones">
        <DetailValue label="Justificación de desviación">{detail.varianceReason || 'Sin desviación documentada'}</DetailValue>
        <DetailValue label="Novedades y drenaje">{detail.notes || 'Sin observaciones'}</DetailValue>
      </DetailSection>
      <DetailSection title="Lecturas de humedad">
        <DetailValue label="Lectura anterior"><Reading reading={before} /></DetailValue>
        <DetailValue label="Lectura posterior"><Reading reading={after} /></DetailValue>
      </DetailSection>
      <PhotoGallery target={{ eventId: detail.eventId }} onBusyChange={onPhotoBusy} />
    </>;
  }

  if ('scheduledOn' in detail) return <>
    <div className="farm-work-context">
      <span className="farm-work-context-icon"><CalendarDays size={24} /></span>
      <div><strong>{sectorName(detail.sectorId)}</strong><small>{recordedDate(`${detail.scheduledOn}T${detail.scheduledTime}`)}</small></div>
      <Badge tone={detail.status === 'CANCELED' ? 'red' : 'green'}>
        {detail.status === 'CANCELED' ? 'Anulada' : 'Programada'}
      </Badge>
    </div>
    <DetailSection title="Programación y ejecución">
      <DetailValue label="Volumen previsto"><Quantity value={detail.volumeM3} unit="m³" /></DetailValue>
      <DetailValue label="Volumen registrado"><Quantity value={detail.actualVolumeM3} unit="m³" /></DetailValue>
      <DetailValue label="Duración prevista"><Quantity value={detail.durationMinutes} unit="min" /></DetailValue>
      <DetailValue label="Tiempo efectivo registrado"><Quantity value={detail.actualDurationMinutes} unit="min" /></DetailValue>
      <DetailValue label="Responsable">{memberName(detail.assigneeId)}</DetailValue>
      <DetailValue label="Tarea">{detail.taskId == null ? 'Sin tarea' : `#${detail.taskId}`}</DetailValue>
      <DetailValue label="Justificación técnica" wide>{detail.justification || 'Sin justificación registrada'}</DetailValue>
      <DetailValue label="Instrucciones de ejecución" wide>{detail.instructions || 'Sin instrucciones'}</DetailValue>
      {detail.cancelReason && <DetailValue label="Motivo de anulación" wide>{detail.cancelReason}</DetailValue>}
      {detail.canceledBy != null && <DetailValue label="Anulada por">{memberName(detail.canceledBy)}</DetailValue>}
    </DetailSection>
    {detail.sectorSnapshot && <SectorDetails sector={detail.sectorSnapshot} blockName={blockName} snapshot />}
    <p className="irrigation-detail-audit">Creada por {memberName(detail.createdBy)} · {recordedDate(detail.createdAt)}</p>
  </>;

  return <>
    <div className="farm-work-context">
      <span className="farm-work-context-icon"><MapPin size={24} /></span>
      <div><strong>{detail.name}</strong><small>{blockName(detail.blockId)}</small></div>
      <Badge tone={detail.condition === 'IN_RANGE' ? 'green' : 'neutral'}>{moistureLabels[detail.condition]}</Badge>
    </div>
    <SectorDetails sector={detail} blockName={blockName} />
    <p className="irrigation-detail-audit">Configuración v{detail.version} · {memberName(detail.createdBy)} · {recordedDate(detail.createdAt)}</p>
  </>;
}
