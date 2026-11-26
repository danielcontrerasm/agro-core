export type Role = 'ADMIN' | 'SUPERVISOR' | 'AGRONOMIST' | 'WORKER';
export type Mode = 'demo' | 'live';
export type Page = 'dashboard' | 'tasks' | 'fields' | 'maps' | 'plants' | 'planting' | 'irrigation' | 'fertilization' | 'disease' | 'harvest' | 'workers' | 'inventory' | 'costs' | 'reports' | 'insights' | 'settings';
export interface User { id: number; name: string; email: string }
export interface Membership { farmId: number; farmName: string; role: Role }
export interface Profile { user: User; memberships: Membership[] }
export interface Farm { id: number; name: string; country?: string; region?: string; geom?: PolygonGeometry }
export interface PolygonGeometry { type: 'Polygon'; coordinates: number[][][] }
export interface LineStringGeometry { type: 'LineString'; coordinates: number[][] }
export interface Field { id: number; name: string; farm: Farm; areaHa?: number; geom?: PolygonGeometry }
export interface Block { id: number; code: string; field: Field; crop: string; cropId?: number; variety?: string; varietyId?: number; areaHa?: number; geom?: PolygonGeometry }
export interface Row { id: number; rowCode: string; block: Block; geom?: LineStringGeometry; lengthM?: number; plantSpacingM?: number; plantsEstimated?: number }
export type EventType = 'SCOUTING_OBSERVATION' | 'TREATMENT_APPLICATION' | 'FERTILIZER_APPLICATION' | 'IRRIGATION_EVENT' | 'HANDLING_EVENT' | 'SOIL_SAMPLE' | 'HARVEST_EVENT';
export interface FieldEvent {
  id: number; eventType: EventType; occurredAt: string; notes?: string; block?: Block; row?: Row;
  createdByUserId: number; plantIndexStart?: number; plantIndexEnd?: number;
  observation?: { severity?: number; symptoms?: string; suspectedCatalogId?: number };
  legacyObservation?: import('./legacy-observation').LegacyObservation;
}
export interface Member { userId: number; name: string; email: string; role: Role }
export interface DiseaseFeature { type: 'Feature'; geometry: { type: 'LineString'; coordinates: number[][] }; properties: { rowId: number; rowCode: string; maxSeverity: number | null; countObservations: number; lastObservedAt: string | null } }
export interface DiseaseLayer { type: 'FeatureCollection'; features: DiseaseFeature[] }
export interface AnalyticsFeature { type: 'Feature'; geometry: PolygonGeometry; properties: { blockId: number; blockCode: string; crop: string; areaHa?: number; soilMoisture?: number; airHumidity?: number; airTemperature?: number; soilTemperature?: number; nitrogen?: number; phosphorus?: number; potassium?: number; ph?: number; growthStage?: string; estimatedYield: number; harvestedQuantity: number; maxHealthSeverity?: number; healthStatus?: import('./inspections').HealthStatus; conditionStatus: 'DRY' | 'OPTIMAL' | 'WET' | 'NO_DATA'; pestRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'NO_DATA' } }
export interface AnalyticsLayer { type: 'FeatureCollection'; features: (Omit<AnalyticsFeature, 'properties'> & { properties: Omit<AnalyticsFeature['properties'], 'conditionStatus'> & { conditionStatus: AnalyticsFeature['properties']['conditionStatus'] | import('./irrigation').MoistureCondition | 'MULTIPLE_SECTORS'; soilAnalysis?: import('./fertilization').Analysis | null; irrigationSectors?: import('./irrigation').IrrigationSector[] } })[] }
export interface DashboardAnalytics { blocks: number; fertilizer_quantity: number; water_volume: number; harvested_quantity: number; health_observations: number; openAlerts: number; connectedDevices: number; }
export interface FarmData { farms: Farm[]; fields: Field[]; blocks: Block[]; rows: Row[]; events: FieldEvent[] }
export type TaskStatus = 'pending' | 'progress' | 'review' | 'completed' | 'blocked';
export type Activity = 'fertilization' | 'irrigation' | 'scouting' | 'planting' | 'harvest';
export interface Task { id: string; farmId?: number; fieldId?: number; title: string; activity: Activity; blockId?: number; assigneeId?: number; date: string; time: string; assignee: string; priority: 'Alta' | 'Media' | 'Baja'; status: TaskStatus; instructions: string; notes?: string; version?: number }
