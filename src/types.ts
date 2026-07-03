/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EmergencyType = 'fire' | 'landslide' | 'medical' | 'chemical';

export interface EmergencyReport {
  id: string;
  type: EmergencyType;
  lat: number;
  lon: number;
  accuracy: number; // in meters
  timestamp: number;
  networkSignature: string; // Anti-duplicate signature (hash of lat, lon, type, etc.)
  isSimulation?: boolean;
  status: 'pending' | 'dispatched' | 'resolved';
  description?: string;
  assignedUnitId?: string;
  reportedBy?: string;
  requestedVehicles?: {
    fire_truck: boolean;
    ambulance: boolean;
    heavy_rescue: boolean;
    hazmat: boolean;
  };
}

export type UnitType = 'fire_truck' | 'heavy_rescue' | 'ambulance' | 'hazmat';
export type UnitStatus = 'available' | 'dispatched' | 'offline';

export interface FleetUnit {
  id: string;
  name: string;
  type: UnitType;
  status: UnitStatus;
  lat: number;
  lon: number;
  speed: number; // km/h
  bearing: number; // degrees (0-360)
  batteryOrFuel: number; // percentage (0-100)
  activeMissionId?: string; // ID of the assigned EmergencyReport
  routePoints?: [number, number][]; // GPS route path
  currentRouteIndex?: number; // active index in routePoints
  isSimulation?: boolean;
  baseSectorId?: string; // Home base sector
  originalBaseSectorId?: string; // Permanent original base sector
  hasAutoReRoutedForTraffic?: boolean; // Avoid infinite traffic pivot loops
  trafficDelay?: boolean; // Signal to UI if unit is in gridlock
}

export interface CoverageSector {
  id: string;
  name: string;
  polygon: [number, number][]; // Array of Lat, Lon coordinates defining the boundary
  center: [number, number]; // Centroid of the polygon
  baseRisk: number; // Base structural risk rating (0.0 to 1.0)
  populationDensity: number; // Population density (people/km2)
  ivr: number; // Calculated dynamic Index of Residual Vulnerability (0.0 to 1.0)
}

export interface PhysicalConstraint {
  id: string;
  name: string;
  type: 'low_bridge' | 'narrow_street' | 'weight_limit';
  lat: number;
  lon: number;
  limitValue: string; // e.g., "3.8m", "2.5m", "12 Tons"
  description: string;
  affectedTypes: UnitType[];
}

export type DisasterType = 'earthquake' | 'wildfire' | 'chemical_spill' | 'tsunami';

export interface SimulationConfig {
  type: DisasterType;
  lat: number;
  lon: number;
  radius: number; // in kilometers
  magnitude: number; // Severity rating (1.0 to 10.0)
  populationAffected: number;
}

export interface ResourceInventory {
  fire_truck: number;
  heavy_rescue: number;
  ambulance: number;
  hazmat: number;
}

export interface PrescriptionItem {
  item: string;
  required: number;
  current: number;
  deficit: number;
  priority: 'high' | 'medium' | 'low';
}

export interface SimulationResult {
  simulationId: string;
  timestamp: number;
  config: SimulationConfig;
  calculatedRiskScore: number; // 0.0 to 100.0
  estimatedCasualties: number;
  resourceDeficit: ResourceInventory;
  inventoryPrescription: PrescriptionItem[];
  overallSurvivalRate: number; // percentage (0-100)
}

// Sandbox & Drill Types
export interface DrillSession {
  isActive: boolean;
  drillId: string;
  name: string;
  startTime: number;
  duration: number; // total expected duration in seconds
  elapsedSeconds: number;
  injectedEvents: InjectedEvent[];
  performances: UserPerformance[];
}

export interface InjectedEvent {
  id: string;
  delaySeconds: number; // Delay relative to drill start
  report: EmergencyReport;
  isTriggered: boolean;
  triggerTime?: number;
}

export interface UserPerformance {
  userId: string;
  username: string;
  averageResponseTimeSec: number; // Dispatch latency
  routeBlockBypasses: number; // Successful reroutes handled
  ivrSpikesPrevented: number; // Maintain area coverage safety margin
  score: number; // Evaluation rating 0-100
  rank: 'Commander' | 'Officer' | 'Recruit';
}

// Websocket / Realtime Event Protocol Payloads
export type EventType =
  | 'init_state'
  | 'emergency_reported'
  | 'emergency_updated'
  | 'unit_telemetry'
  | 'unit_dispatched'
  | 'unit_return_home'
  | 'unit_route_blocked'
  | 'dead_man_tick'
  | 'dead_man_triggered'
  | 'dead_man_reset'
  | 'drill_started'
  | 'drill_tick'
  | 'drill_event_triggered'
  | 'drill_stopped'
  | 'simulation_run'
  | 'ivr_recalculated'
  | 'system_alert'
  | 'autonomous_decision'
  | 'base_station_added';

export interface RealtimeMessage {
  type: EventType;
  payload: any;
  timestamp: number;
  isSimulation?: boolean; // Isolation flag for training sandbox
}
