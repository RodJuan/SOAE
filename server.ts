/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import {
  EmergencyReport,
  FleetUnit,
  CoverageSector,
  RealtimeMessage,
  SimulationConfig,
  ResourceInventory,
  PhysicalConstraint,
  UnitType
} from './src/types';
import { runPredictiveStressTest } from './src/simulation/PredictiveEngine';
import { DrillManager } from './src/simulation/DrillServer';
import { rateLimit } from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express, HTTP Server, and WebSocket Server
const app = express();
app.set('trust proxy', 1); // Trust first-level reverse proxy (Nginx, Cloud Run)
const httpServer = createHttpServer(app);
const wss = new WebSocketServer({ server: httpServer });
const PORT = 3000;

app.use(express.json());

// Rate Limiting Middlewares for civilian infrastructure resilience
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Core operational interface restricted for 15 minutes.' }
});

const simulationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Simulation bandwidth exceeded. Please try again after 5 minutes.' }
});

// Apply rate limiters to API routes to restrict high-frequency spamming
app.use('/api/', generalLimiter);
app.use('/api/simulation/test', simulationLimiter);
app.use('/api/optimization/match', simulationLimiter);
app.use('/api/system/reset', simulationLimiter);

// ==========================================
// 1. SYSTEM BASE STATE (REAL WORLD IN-MEMORY)
// ==========================================

let currentBaseLat = 19.4326;
let currentBaseLon = -99.1332;
let currentRegionName = 'Autodetect by GPS';

let sectors: CoverageSector[] = [];
let units: FleetUnit[] = [];
let reports: EmergencyReport[] = [];
let physicalConstraints: PhysicalConstraint[] = [];
let autonomousDecisions: any[] = [];

// Track active Dead Man's Switch timers
interface DeadManState {
  reportId: string;
  timeLeft: number; // seconds
  interval: NodeJS.Timeout;
}
const activeDeadManSwitches = new Map<string, DeadManState>();

// Initialize sectors, units and clear reports relative to base coordinates
function initializeSectorsAndUnits(lat: number, lon: number, regionName: string) {
  currentBaseLat = lat;
  currentBaseLon = lon;
  currentRegionName = regionName;

  sectors = [
    {
      id: 'sec-centro',
      name: `Sector Centro (${regionName})`,
      baseRisk: 0.65,
      populationDensity: 18500, // people/km2
      center: [lat + 0.003, lon - 0.003],
      ivr: 0.0,
      polygon: [
        [lat + 0.015, lon - 0.015],
        [lat + 0.015, lon + 0.015],
        [lat - 0.015, lon + 0.015],
        [lat - 0.015, lon - 0.015]
      ]
    },
    {
      id: 'sec-norte',
      name: `Sector Norte (${regionName})`,
      baseRisk: 0.75, // High risk
      populationDensity: 9200,
      center: [lat + 0.04, lon - 0.01],
      ivr: 0.0,
      polygon: [
        [lat + 0.055, lon - 0.03],
        [lat + 0.055, lon + 0.01],
        [lat + 0.025, lon + 0.01],
        [lat + 0.025, lon - 0.03]
      ]
    },
    {
      id: 'sec-sur',
      name: `Sector Sur (${regionName})`,
      baseRisk: 0.55,
      populationDensity: 6500,
      center: [lat - 0.05, lon - 0.02],
      ivr: 0.0,
      polygon: [
        [lat - 0.035, lon - 0.04],
        [lat - 0.035, lon + 0.0],
        [lat - 0.065, lon + 0.0],
        [lat - 0.065, lon - 0.04]
      ]
    },
    {
      id: 'sec-este',
      name: `Sector Este (${regionName})`,
      baseRisk: 0.45,
      populationDensity: 22000,
      center: [lat - 0.01, lon + 0.015],
      ivr: 0.0,
      polygon: [
        [lat + 0.01, lon + 0.005],
        [lat + 0.01, lon + 0.025],
        [lat - 0.03, lon + 0.025],
        [lat - 0.03, lon + 0.005]
      ]
    },
    {
      id: 'sec-oeste',
      name: `Sector Oeste (${regionName})`,
      baseRisk: 0.35,
      populationDensity: 11000,
      center: [lat + 0.005, lon - 0.045],
      ivr: 0.0,
      polygon: [
        [lat + 0.02, lon - 0.06],
        [lat + 0.02, lon - 0.03],
        [lat - 0.01, lon - 0.03],
        [lat - 0.01, lon - 0.06]
      ]
    }
  ];

  units = [
    {
      id: 'unit-fire-1',
      name: 'FÉNIX-01 (Bomba Pesada)',
      type: 'fire_truck',
      status: 'available',
      lat: lat + 0.003,
      lon: lon - 0.003,
      speed: 0,
      bearing: 90,
      batteryOrFuel: 94,
      baseSectorId: 'sec-centro',
      originalBaseSectorId: 'sec-centro'
    },
    {
      id: 'unit-rescue-1',
      name: 'TITÁN-01 (Fuerza de Rescate)',
      type: 'heavy_rescue',
      status: 'available',
      lat: lat - 0.05,
      lon: lon - 0.02,
      speed: 0,
      bearing: 180,
      batteryOrFuel: 88,
      baseSectorId: 'sec-sur',
      originalBaseSectorId: 'sec-sur'
    },
    {
      id: 'unit-ambulance-1',
      name: 'MED-01 (Soporte Vital Avanzado)',
      type: 'ambulance',
      status: 'available',
      lat: lat - 0.01,
      lon: lon + 0.015,
      speed: 0,
      bearing: 270,
      batteryOrFuel: 100,
      baseSectorId: 'sec-este',
      originalBaseSectorId: 'sec-este'
    },
    {
      id: 'unit-hazmat-1',
      name: 'VULCANO-01 (Contención Química)',
      type: 'hazmat',
      status: 'available',
      lat: lat + 0.04,
      lon: lon - 0.01,
      speed: 0,
      bearing: 0,
      batteryOrFuel: 85,
      baseSectorId: 'sec-norte',
      originalBaseSectorId: 'sec-norte'
    },
    {
      id: 'unit-fire-2',
      name: 'FÉNIX-02 (Ataque Rápido)',
      type: 'fire_truck',
      status: 'available',
      lat: lat + 0.005,
      lon: lon - 0.045,
      speed: 0,
      bearing: 45,
      batteryOrFuel: 92,
      baseSectorId: 'sec-oeste',
      originalBaseSectorId: 'sec-oeste'
    }
  ];

  reports = [];
  autonomousDecisions = [];
  activeDeadManSwitches.forEach((dms) => clearInterval(dms.interval));
  activeDeadManSwitches.clear();

  physicalConstraints = [
    {
      id: 'bridge-height-1',
      name: 'Paso Bajo Nivel Ferrocarril',
      type: 'low_bridge',
      lat: lat + 0.012,
      lon: lon + 0.018,
      limitValue: '3.8m',
      description: 'Restricción de altura para camiones de bomberos pesados y unidades químicas.',
      affectedTypes: ['fire_truck', 'hazmat', 'heavy_rescue'] as UnitType[]
    },
    {
      id: 'narrow-street-1',
      name: 'Callejón Histórico San Juan',
      type: 'narrow_street',
      lat: lat - 0.010,
      lon: lon - 0.012,
      limitValue: '2.5m',
      description: 'Ancho de vía extremadamente reducido. Solo ambulancias permitidas.',
      affectedTypes: ['fire_truck', 'hazmat', 'heavy_rescue'] as UnitType[]
    },
    {
      id: 'weight-limit-1',
      name: 'Puente Colgante Río Viejo',
      type: 'weight_limit',
      lat: lat + 0.024,
      lon: lon - 0.015,
      limitValue: '12 Tons',
      description: 'Límite de carga estructural. Vehículos pesados de rescate deben desviarse.',
      affectedTypes: ['fire_truck', 'hazmat', 'heavy_rescue'] as UnitType[]
    }
  ];
}

// Initial state creation
initializeSectorsAndUnits(currentBaseLat, currentBaseLon, currentRegionName);

// ==========================================
// 2. HELPER MATHEMATICS & UTILITIES
// ==========================================

// Haversine formula to compute geodesic distance in KM
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Recalculates the Index of Residual Vulnerability (IVR) dynamically for all sectors
function recalculateIvr(isSimulation: boolean = false) {
  const activeSectors = isSimulation ? drillManager.sectors : sectors;
  const activeUnits = isSimulation ? drillManager.units : units;

  activeSectors.forEach((sec) => {
    // Find available units whose home base is this sector
    const sectorUnits = activeUnits.filter(
      (u) => u.baseSectorId === sec.id && u.status === 'available'
    );

    // Sum their responder weights to measure available capacity
    let totalCapacityWeight = 0;
    sectorUnits.forEach((u) => {
      switch (u.type) {
        case 'fire_truck':
          totalCapacityWeight += 1.5;
          break;
        case 'heavy_rescue':
          totalCapacityWeight += 1.5;
          break;
        case 'hazmat':
          totalCapacityWeight += 1.5;
          break;
        case 'ambulance':
          totalCapacityWeight += 1.0;
          break;
      }
    });

    // Dynamic IVR formula: Higher base risk & density spikes the IVR.
    // Greater local responder capacity dampens the vulnerability.
    const riskFactor = sec.baseRisk * (1 + sec.populationDensity / 25000);
    const capacityDampening = 2 / (2 + totalCapacityWeight);
    
    // Clamp between 0.0 and 1.0
    sec.ivr = Math.max(0.1, Math.min(1.0, riskFactor * capacityDampening));

    // In a drill session, if IVR spikes critically (> 0.85), record it for score grading
    if (isSimulation && sec.ivr > 0.85) {
      drillManager.recordIvrSpike();
    }
  });

  // Broadcast IVR updates to clients
  broadcastToAll({
    type: 'ivr_recalculated',
    payload: activeSectors,
    timestamp: Date.now(),
    isSimulation
  });
}

// Initialize IVR values on startup
recalculateIvr(false);

// Robust Real-World Street Routing with OSRM and stable, non-drifting Local Fallback Pathfinding
async function fetchRealWorldRoute(
  unitId: string,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  blockedPoint?: [number, number] | null,
  isSim: boolean = false
) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`OSRM HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (!coords || coords.length === 0) {
      throw new Error('OSRM returned empty geometry');
    }
    
    let points: [number, number][] = coords.map((c: any) => [c[1], c[0]]);
    const dbUnits = isSim ? drillManager.units : units;
    const unit = dbUnits.find(u => u.id === unitId);
    
    // Apply detour if route is too close to blockedPoint
    if (blockedPoint) {
      const threshold = 0.0012; // approx 130 meters
      const isBlocked = points.some(p => 
        Math.abs(p[0] - blockedPoint[0]) < threshold && 
        Math.abs(p[1] - blockedPoint[1]) < threshold
      );
      if (isBlocked) {
        const dLat = endLat - startLat;
        const dLon = endLon - startLon;
        const length = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
        const perpLat = -dLon / length;
        const perpLon = dLat / length;
        const detourLat = perpLat * 0.003;
        const detourLon = perpLon * 0.003;

        points = points.map((p, idx) => {
          const t = idx / (points.length - 1);
          const detourFactor = Math.sin(t * Math.PI);
          return [
            p[0] + detourLat * detourFactor,
            p[1] + detourLon * detourFactor
          ];
        });
      }
    }

    // Check and apply physical constraints detour if vehicle type is affected
    if (unit) {
      physicalConstraints.forEach((constraint) => {
        if (constraint.affectedTypes.includes(unit.type)) {
          const isNear = points.some(p => 
            getHaversineDistance(p[0], p[1], constraint.lat, constraint.lon) < 0.25
          );
          if (isNear) {
            const dLat = endLat - startLat;
            const dLon = endLon - startLon;
            const length = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
            const perpLat = -dLon / length;
            const perpLon = dLat / length;
            const detourLat = perpLat * 0.004;
            const detourLon = perpLon * 0.004;

            points = points.map((p, idx) => {
              const t = idx / (points.length - 1);
              const detourFactor = Math.sin(t * Math.PI);
              return [
                p[0] + detourLat * detourFactor,
                p[1] + detourLon * detourFactor
              ];
            });

            broadcastToAll({
              type: 'system_alert',
              payload: {
                msg: isSim
                  ? `[SIMULACRO] 🚧 RESTRICCIÓN DE VEHÍCULO: ¡Ruta de ${unit.name} desviada para evadir '${constraint.name}' (${constraint.limitValue})!`
                  : `🚧 PHYSICAL CONSTRAINT: ${unit.name} route automatically re-optimized to bypass '${constraint.name}' (${constraint.limitValue}) for secure transit.`,
                type: 'warning'
              },
              timestamp: Date.now(),
              isSimulation: isSim
            });
          }
        }
      });
    }

    points[0] = [startLat, startLon];
    points[points.length - 1] = [endLat, endLon];

    if (unit && unit.status === 'dispatched') {
      unit.routePoints = points;
      unit.currentRouteIndex = 0;
      
      broadcastToAll({
        type: 'unit_telemetry',
        payload: unit,
        timestamp: Date.now(),
        isSimulation: isSim
      });
    }
  } catch (err: any) {
    console.log(`OSRM routing failed for unit ${unitId}, using fallback:`, err.message);
  }
}

function generateLocalFallbackRoute(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  blockedPoint?: [number, number] | null,
  unitType?: UnitType | null
): [number, number][] {
  const points: [number, number][] = [];
  const steps = 8;

  let detourLat = 0;
  let detourLon = 0;
  if (blockedPoint) {
    const dLat = endLat - startLat;
    const dLon = endLon - startLon;
    const length = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
    const perpLat = -dLon / length;
    const perpLon = dLat / length;
    detourLat = perpLat * 0.003;
    detourLon = perpLon * 0.003;
  }

  if (unitType) {
    const affectedConstraints = physicalConstraints.filter(c => c.affectedTypes.includes(unitType));
    for (const constraint of affectedConstraints) {
      const midLat = (startLat + endLat) / 2;
      const midLon = (startLon + endLon) / 2;
      const distToMid = getHaversineDistance(midLat, midLon, constraint.lat, constraint.lon);
      if (distToMid < 0.6) {
        const dLat = endLat - startLat;
        const dLon = endLon - startLon;
        const length = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
        const perpLat = -dLon / length;
        const perpLon = dLat / length;
        detourLat += perpLat * 0.0035;
        detourLon += perpLon * 0.0035;
        break;
      }
    }
  }

  let currentLat = startLat;
  let currentLon = startLon;
  points.push([currentLat, currentLon]);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const targetLat = startLat + (endLat - startLat) * t;
    const targetLon = startLon + (endLon - startLon) * t;

    if (i % 2 === 1) {
      currentLon = targetLon;
    } else {
      currentLat = targetLat;
    }

    const detourFactor = Math.sin(t * Math.PI);
    const finalLat = currentLat + detourLat * detourFactor;
    const finalLon = currentLon + detourLon * detourFactor;

    points.push([finalLat, finalLon]);
  }

  points[0] = [startLat, startLon];
  points[points.length - 1] = [endLat, endLon];

  const cleaned: [number, number][] = [];
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      cleaned.push(points[i]);
    } else {
      const prev = cleaned[cleaned.length - 1];
      const curr = points[i];
      if (Math.abs(prev[0] - curr[0]) > 0.00001 || Math.abs(prev[1] - curr[1]) > 0.00001) {
        cleaned.push(curr);
      }
    }
  }

  return cleaned;
}

function generateRoutePoints(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  blockedPoint?: [number, number] | null,
  unitId?: string | null,
  isSim: boolean = false
): [number, number][] {
  const dbUnits = isSim ? drillManager.units : units;
  const unit = unitId ? dbUnits.find(u => u.id === unitId) : null;
  const unitType = unit ? unit.type : null;

  // 1. Instantly return high-quality, non-drifting local street grid fallback
  const fallback = generateLocalFallbackRoute(startLat, startLon, endLat, endLon, blockedPoint, unitType);

  // 2. Trigger asynchronous background OSRM real-world street topology route fetch
  if (unitId) {
    fetchRealWorldRoute(unitId, startLat, startLon, endLat, endLon, blockedPoint, isSim);
  }

  return fallback;
}

// Active dynamic obstacle avoidance and real-time rerouting engine
function checkAndAvoidObstacles(isSim: boolean, newIncident?: EmergencyReport) {
  const dbUnits = isSim ? drillManager.units : units;
  const dbReports = isSim ? drillManager.reports : reports;

  dbUnits.forEach((unit) => {
    // Only check active dispatched units that are on actual missions (not returning to home base)
    if (
      unit.status === 'dispatched' &&
      unit.activeMissionId &&
      unit.activeMissionId !== 'return-home' &&
      !unit.activeMissionId.startsWith('cover-') &&
      unit.routePoints &&
      unit.routePoints.length > 0
    ) {
      // Find the mission's destination report
      const rep = dbReports.find((r) => r.id === unit.activeMissionId);
      if (!rep) return;

      // Check remaining route points starting from current GPS index
      const startIdx = unit.currentRouteIndex ?? 0;
      const remainingPoints = unit.routePoints.slice(startIdx);

      // Check if any remaining point is close to any other active report/obstacle
      let compromisedPoint: [number, number] | null = null;
      let reason = '';

      for (const obstacle of dbReports) {
        if (obstacle.id === rep.id || obstacle.status === 'resolved') continue;

        // Check if any point in the remaining path is too close to this obstacle (within 220 meters)
        const isNear = remainingPoints.some((p) => {
          const dist = getHaversineDistance(p[0], p[1], obstacle.lat, obstacle.lon);
          return dist < 0.22; // 220 meters proximity threshold
        });

        if (isNear) {
          compromisedPoint = [obstacle.lat, obstacle.lon];
          reason = obstacle.description || 'zona de peligro activa';
          break;
        }
      }

      if (compromisedPoint) {
        // Trigger automatic on-the-fly path recalculation to bypass the obstacle
        console.log(`[OBSTACLE REDIRECT] Unit ${unit.name} route intercepted by incident. Recalculating detour...`);

        // Recalculate route bypassing this compromised point!
        const detourPoints = generateRoutePoints(
          unit.lat,
          unit.lon,
          rep.lat,
          rep.lon,
          compromisedPoint,
          unit.id,
          isSim
        );

        unit.routePoints = detourPoints;
        unit.currentRouteIndex = 0;

        // Reward user drill score for bypassing a route block
        if (isSim) {
          drillManager.recordRouteBlockBypass();
        }

        // Notify client via alert message
        broadcastToAll({
          type: 'system_alert',
          payload: {
            msg: isSim 
              ? `[SIMULACRO - EVASIÓN] 🤖 CO-PILOTO SATELITAL: ¡Ruta de ${unit.name} interceptada por incidente! Recalculando desvío automático de forma dinámica.`
              : `🤖 SATELLITE CO-PILOT: Real-time obstacle detected on route for ${unit.name}. GPS guidance successfully pivoted onto alternative safe corridor.`,
            type: 'warning'
          },
          timestamp: Date.now(),
          isSimulation: isSim
        });

        // Broadcast the updated unit telemetry
        broadcastToAll({
          type: 'unit_telemetry',
          payload: unit,
          timestamp: Date.now(),
          isSimulation: isSim
        });
      }
    }
  });
}

// ==========================================
// 3. MIXED INTEGER DISPATCH OPTIMIZATION ENGINE
// ==========================================
interface OptimizationResult {
  optimalUnit: FleetUnit | null;
  reasons: string[];
  isLocked: boolean;
  score: number;
  coDeployment?: {
    unit: FleetUnit;
    score: number;
    reasons: string[];
    isLocked: boolean;
  }[];
}

function runDispatchOptimization(
  report: EmergencyReport,
  isSimulation: boolean = false
): OptimizationResult {
  const activeUnits = isSimulation ? drillManager.units : units;
  const activeSectors = isSimulation ? drillManager.sectors : sectors;

  // 1. Identify all requested vehicle types for co-deployment
  const requestedTypes: UnitType[] = [];
  if (report.requestedVehicles) {
    if (report.requestedVehicles.fire_truck) requestedTypes.push('fire_truck');
    if (report.requestedVehicles.ambulance) requestedTypes.push('ambulance');
    if (report.requestedVehicles.heavy_rescue) requestedTypes.push('heavy_rescue');
    if (report.requestedVehicles.hazmat) requestedTypes.push('hazmat');
  }

  // Fallback to primary type mapping if none specified
  if (requestedTypes.length === 0) {
    if (report.type === 'fire') requestedTypes.push('fire_truck');
    if (report.type === 'medical') requestedTypes.push('ambulance');
    if (report.type === 'landslide') requestedTypes.push('heavy_rescue');
    if (report.type === 'chemical') requestedTypes.push('hazmat');
  }

  const coDeployment: {
    unit: FleetUnit;
    score: number;
    reasons: string[];
    isLocked: boolean;
  }[] = [];

  const assignedUnitIds = new Set<string>();

  requestedTypes.forEach((targetType) => {
    let bestUnitForType: FleetUnit | null = null;
    let maxScoreForType = -999999;
    let reasonsForType: string[] = [];
    let isTypeLocked = false;

    activeUnits.forEach((unit) => {
      // Must be available, correct type, and not already selected for another category in this co-deployment
      if (unit.status !== 'available' || unit.type !== targetType || assignedUnitIds.has(unit.id)) return;

      let score = 100.0;
      const dist = getHaversineDistance(unit.lat, unit.lon, report.lat, report.lon);
      
      // Average dispatch speed by type (km/h)
      let avgSpeed = 45;
      if (unit.type === 'ambulance') avgSpeed = 55;
      if (unit.type === 'fire_truck') avgSpeed = 48;
      if (unit.type === 'heavy_rescue') avgSpeed = 40;

      // Response travel time in seconds
      const travelTimeSec = (dist / avgSpeed) * 3600;
      
      // Survival decay curve: S(t) = 100 * exp(-0.0012 * t_sec)
      const decayLambda = 0.0012;
      const baseSurvival = 100 * Math.exp(-decayLambda * travelTimeSec);
      score += baseSurvival;

      // Fuel weight
      score += (unit.batteryOrFuel / 100) * 5;

      const unitReasons: string[] = [];
      let unitLocked = false;

      // UNDERMANNING / IVR PENALTY:
      // Compute what the home sector's IVR *would* be if this unit was dispatched
      const homeSec = activeSectors.find((s) => s.id === unit.baseSectorId);
      if (homeSec) {
        const otherAvailableHomeUnits = activeUnits.filter(
          (u) => u.baseSectorId === homeSec.id && u.status === 'available' && u.id !== unit.id
        );

        let hypotheticalWeight = 0;
        otherAvailableHomeUnits.forEach((u) => {
          if (u.type === 'fire_truck') hypotheticalWeight += 1.5;
          if (u.type === 'heavy_rescue') hypotheticalWeight += 1.5;
          if (u.type === 'hazmat') hypotheticalWeight += 1.5;
          if (u.type === 'ambulance') hypotheticalWeight += 1.0;
        });

        const hypRisk = homeSec.baseRisk * (1 + homeSec.populationDensity / 25000);
        const hypIvr = Math.max(0.1, Math.min(1.0, hypRisk * (2 / (2 + hypotheticalWeight))));

        // If moving this unit spikes home IVR > 0.85, add an informative notice (no score penalty)
        if (hypIvr > 0.85) {
          unitReasons.push(`${unit.name}: El despacho desguarnece ${homeSec.name} (IVR proyectado: ${hypIvr.toFixed(2)}). Se compensará con cobertura dinámica.`);
        }

        // MINIMUM RESCUE LOCK: Check if this is the last available unit of this type.
        const sameTypeHomeUnits = activeUnits.filter(
          (u) => u.baseSectorId === homeSec.id && u.status === 'available' && u.type === unit.type
        );
        if (sameTypeHomeUnits.length <= 1) {
          unitReasons.push(`${unit.name}: Último recurso en ${homeSec.name}. Despacho optimizado con redespliegue de resguardo automático.`);
          unitLocked = true;
        }
      }

      if (score > maxScoreForType) {
        maxScoreForType = score;
        bestUnitForType = unit;
        reasonsForType = unitReasons;
        isTypeLocked = unitLocked;
      }
    });

    if (bestUnitForType) {
      assignedUnitIds.add(bestUnitForType.id);
      coDeployment.push({
        unit: bestUnitForType,
        score: Math.max(0, maxScoreForType),
        reasons: reasonsForType,
        isLocked: isTypeLocked
      });
    }
  });

  const primaryRec = coDeployment[0] || null;

  return {
    optimalUnit: primaryRec ? primaryRec.unit : null,
    reasons: primaryRec ? primaryRec.reasons : [],
    isLocked: primaryRec ? primaryRec.isLocked : false,
    score: primaryRec ? primaryRec.score : 0,
    coDeployment
  };
}

// ==========================================
// 4. WEBSOCKET BROADCASTER & EVENT PROCESSORS
// ==========================================

function broadcastToAll(message: RealtimeMessage) {
  const json = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

// Create a singleton instance of the Drill Simulator Manager
const drillManager = new DrillManager(broadcastToAll);

// Simulates a telemetry route progression for active dispatched units
setInterval(() => {
  // 1. Process Real World telemetry
  units.forEach((unit) => {
    if (unit.status === 'dispatched' && unit.routePoints && unit.routePoints.length > 0) {
      const idx = unit.currentRouteIndex ?? 0;
      if (idx < unit.routePoints.length - 1) {
        const nextIdx = idx + 1;
        const [currLat, currLon] = unit.routePoints[idx];
        const [nextLat, nextLon] = unit.routePoints[nextIdx];

        // CHECK FOR TRAFFIC CONGESTION
        const assignedReport = reports.find(r => r.id === unit.activeMissionId);
        
        let inTrafficJam = false;
        let trafficHotspotName = '';
        let trafficHotspotCoord: [number, number] | null = null;

        for (const rep of reports) {
          if (rep.status === 'resolved' || (assignedReport && rep.id === assignedReport.id)) continue;
          const dist = getHaversineDistance(currLat, currLon, rep.lat, rep.lon);
          if (dist < 0.25) { // 250 meters proximity
            inTrafficJam = true;
            trafficHotspotName = rep.description || 'zona de incidente';
            trafficHotspotCoord = [rep.lat, rep.lon];
            break;
          }
        }

        let speed = 45 + Math.random() * 15;
        if (inTrafficJam) {
          // Crawl in traffic
          speed = 4 + Math.random() * 4;
          unit.trafficDelay = true;
          
          if (!unit.hasAutoReRoutedForTraffic) {
            unit.hasAutoReRoutedForTraffic = true;
            
            // Trigger automatic detour bypassing the traffic hotspot
            setTimeout(() => {
              if (unit.status === 'dispatched' && assignedReport) {
                const detourPoints = generateRoutePoints(
                  unit.lat,
                  unit.lon,
                  assignedReport.lat,
                  assignedReport.lon,
                  trafficHotspotCoord,
                  unit.id,
                  false
                );
                unit.routePoints = detourPoints;
                unit.currentRouteIndex = 0;
                
                broadcastToAll({
                  type: 'system_alert',
                  payload: {
                    msg: `⚡ SATELLITE PILOT: Redirigiendo ${unit.name} para evitar embotellamiento crítico (tránsito lento a ${speed.toFixed(1)} km/h) cerca de ${trafficHotspotName.substring(0, 35)}...`,
                    type: 'info'
                  },
                  timestamp: Date.now(),
                  isSimulation: false
                });
              }
            }, 1000);
          }
        } else {
          unit.trafficDelay = false;
        }

        // Simulate travel physics
        unit.currentRouteIndex = nextIdx;
        unit.lat = nextLat;
        unit.lon = nextLon;
        unit.speed = speed;
        
        // Calculate bearing angle
        const y = Math.sin((nextLon - currLon) * Math.PI / 180) * Math.cos(nextLat * Math.PI / 180);
        const x = Math.cos(currLat * Math.PI / 180) * Math.sin(nextLat * Math.PI / 180) -
                  Math.sin(currLat * Math.PI / 180) * Math.cos(nextLat * Math.PI / 180) * Math.cos((nextLon - currLon) * Math.PI / 180);
        unit.bearing = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
        
        // Consume fuel
        unit.batteryOrFuel = Math.max(0, unit.batteryOrFuel - 0.25);

        broadcastToAll({
          type: 'unit_telemetry',
          payload: unit,
          timestamp: Date.now(),
          isSimulation: false
        });
      } else {
        // Destination arrived! Resolve emergency
        const reportId = unit.activeMissionId;
        unit.status = 'available';
        unit.activeMissionId = undefined;
        unit.routePoints = undefined;
        unit.currentRouteIndex = undefined;
        unit.speed = 0;

        if (reportId) {
          const rep = reports.find((r) => r.id === reportId);
          if (rep) {
            rep.status = 'resolved';
            // Stop Dead-man's Switch if pending
            clearDeadManSwitch(reportId);

            broadcastToAll({
              type: 'emergency_updated',
              payload: rep,
              timestamp: Date.now(),
              isSimulation: false
            });

            // TRIGGER RETURN TO ORIGINAL HOME BASE FOR THE INCIDENT RESPONDER
            const homeSecId = unit.originalBaseSectorId || unit.baseSectorId;
            const homeSector = sectors.find(s => s.id === homeSecId);
            if (homeSector) {
              unit.status = 'dispatched';
              unit.activeMissionId = 'return-home';
              unit.currentRouteIndex = 0;
              unit.routePoints = generateRoutePoints(unit.lat, unit.lon, homeSector.center[0], homeSector.center[1], null, unit.id, false);
              unit.baseSectorId = homeSector.id; // Restore original base sector

              broadcastToAll({
                type: 'system_alert',
                payload: {
                  msg: `[RETORNO A BASE] ${unit.name} COMPLETÓ RESCATE Y RETORNA A SU BASE EN SECTOR ${homeSector.name}.`,
                  type: 'info'
                },
                timestamp: Date.now(),
                isSimulation: false
              });
            }

            // TRIGGER RETURNING TO BASE FOR ANY TEMPORARY COVERING UNIT
            const coveringUnit = units.find(u => 
              (u.baseSectorId === homeSecId && u.originalBaseSectorId && u.originalBaseSectorId !== homeSecId) ||
              (u.activeMissionId === `cover-${homeSecId}`)
            );
            if (coveringUnit) {
              const origHomeSecId = coveringUnit.originalBaseSectorId || coveringUnit.baseSectorId;
              const origHomeSector = sectors.find(s => s.id === origHomeSecId);
              if (origHomeSector) {
                coveringUnit.status = 'dispatched';
                coveringUnit.activeMissionId = 'return-home';
                coveringUnit.currentRouteIndex = 0;
                coveringUnit.routePoints = generateRoutePoints(coveringUnit.lat, coveringUnit.lon, origHomeSector.center[0], origHomeSector.center[1], null, coveringUnit.id, false);
                coveringUnit.baseSectorId = origHomeSector.id; // Restore original base sector for IVR

                broadcastToAll({
                  type: 'unit_telemetry',
                  payload: coveringUnit,
                  timestamp: Date.now(),
                  isSimulation: false
                });

                broadcastToAll({
                  type: 'system_alert',
                  payload: {
                    msg: `[RETORNO A BASE] ${coveringUnit.name} SUSPENDE COBERTURA Y RETORNA A SU BASE EN SECTOR ${origHomeSector.name}.`,
                    type: 'info'
                  },
                  timestamp: Date.now(),
                  isSimulation: false
                });
              }
            }
          }
        }

        recalculateIvr(false);
        broadcastToAll({
          type: 'unit_telemetry',
          payload: unit,
          timestamp: Date.now(),
          isSimulation: false
        });
      }
    }
  });

  // 2. Process Training Sandbox Telemetry
  if (drillManager.getSession()?.isActive) {
    drillManager.units.forEach((unit) => {
      if (unit.status === 'dispatched' && unit.routePoints && unit.routePoints.length > 0) {
        const idx = unit.currentRouteIndex ?? 0;
        if (idx < unit.routePoints.length - 1) {
          const nextIdx = idx + 1;
          const [currLat, currLon] = unit.routePoints[idx];
          const [nextLat, nextLon] = unit.routePoints[nextIdx];

          // CHECK FOR TRAFFIC CONGESTION IN DRILL
          const dbReports = drillManager.reports;
          const assignedReport = dbReports.find(r => r.id === unit.activeMissionId);
          
          let inTrafficJam = false;
          let trafficHotspotName = '';
          let trafficHotspotCoord: [number, number] | null = null;

          for (const rep of dbReports) {
            if (rep.status === 'resolved' || (assignedReport && rep.id === assignedReport.id)) continue;
            const dist = getHaversineDistance(currLat, currLon, rep.lat, rep.lon);
            if (dist < 0.25) { // 250 meters proximity
              inTrafficJam = true;
              trafficHotspotName = rep.description || 'zona de incidente';
              trafficHotspotCoord = [rep.lat, rep.lon];
              break;
            }
          }

          let speed = 50 + Math.random() * 10;
          if (inTrafficJam) {
            // Crawl in traffic
            speed = 5 + Math.random() * 5;
            unit.trafficDelay = true;
            
            if (!unit.hasAutoReRoutedForTraffic) {
              unit.hasAutoReRoutedForTraffic = true;
              
              // Trigger automatic detour bypassing the traffic hotspot
              setTimeout(() => {
                if (unit.status === 'dispatched' && assignedReport) {
                  const detourPoints = generateRoutePoints(
                    unit.lat,
                    unit.lon,
                    assignedReport.lat,
                    assignedReport.lon,
                    trafficHotspotCoord,
                    unit.id,
                    true
                  );
                  unit.routePoints = detourPoints;
                  unit.currentRouteIndex = 0;
                  drillManager.recordRouteBlockBypass(); // Award drill score detour bonus!
                  
                  broadcastToAll({
                    type: 'system_alert',
                    payload: {
                      msg: `[SIMULACRO] ⚡ NAVEGACIÓN: Redirigiendo ${unit.name} para evitar embotellamiento crítico (tránsito lento a ${speed.toFixed(1)} km/h) cerca de ${trafficHotspotName.substring(0, 35)}...`,
                      type: 'info'
                    },
                    timestamp: Date.now(),
                    isSimulation: true
                  });
                }
              }, 1000);
            }
          } else {
            unit.trafficDelay = false;
          }

          unit.currentRouteIndex = nextIdx;
          unit.lat = nextLat;
          unit.lon = nextLon;
          unit.speed = speed;
          
          const y = Math.sin((nextLon - currLon) * Math.PI / 180) * Math.cos(nextLat * Math.PI / 180);
          const x = Math.cos(currLat * Math.PI / 180) * Math.sin(nextLat * Math.PI / 180) -
                    Math.sin(currLat * Math.PI / 180) * Math.cos(nextLat * Math.PI / 180) * Math.cos((nextLon - currLon) * Math.PI / 180);
          unit.bearing = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
          unit.batteryOrFuel = Math.max(0, unit.batteryOrFuel - 0.2);

          broadcastToAll({
            type: 'unit_telemetry',
            payload: unit,
            timestamp: Date.now(),
            isSimulation: true
          });
        } else {
          const reportId = unit.activeMissionId;
          unit.status = 'available';
          unit.activeMissionId = undefined;
          unit.routePoints = undefined;
          unit.currentRouteIndex = undefined;
          unit.speed = 0;

          if (reportId && reportId !== 'return-home' && !reportId.startsWith('cover-')) {
            const rep = drillManager.reports.find((r) => r.id === reportId);
            if (rep) {
              rep.status = 'resolved';
              broadcastToAll({
                type: 'emergency_updated',
                payload: rep,
                timestamp: Date.now(),
                isSimulation: true
              });

              // TRIGGER RETURN TO ORIGINAL HOME BASE FOR THE INCIDENT RESPONDER IN DRILL
              const homeSecId = unit.originalBaseSectorId || unit.baseSectorId;
              const homeSector = drillManager.sectors.find(s => s.id === homeSecId);
              if (homeSector) {
                unit.status = 'dispatched';
                unit.activeMissionId = 'return-home';
                unit.currentRouteIndex = 0;
                unit.routePoints = generateRoutePoints(unit.lat, unit.lon, homeSector.center[0], homeSector.center[1], null, unit.id, true);
                unit.baseSectorId = homeSector.id; // Restore home sector

                broadcastToAll({
                  type: 'system_alert',
                  payload: {
                    msg: `[SIMULACRO - RETORNO] ${unit.name} COMPLETÓ RESCATE Y RETORNA A SU BASE EN SECTOR ${homeSector.name}.`,
                    type: 'info'
                  },
                  timestamp: Date.now(),
                  isSimulation: true
                });
              }

              // TRIGGER RETURNING TO BASE FOR ANY TEMPORARY COVERING UNIT IN DRILL
              const coveringUnit = drillManager.units.find(u => 
                (u.baseSectorId === homeSecId && u.originalBaseSectorId && u.originalBaseSectorId !== homeSecId) ||
                (u.activeMissionId === `cover-${homeSecId}`)
              );
              if (coveringUnit) {
                const origHomeSecId = coveringUnit.originalBaseSectorId || coveringUnit.baseSectorId;
                const origHomeSector = drillManager.sectors.find(s => s.id === origHomeSecId);
                if (origHomeSector) {
                  coveringUnit.status = 'dispatched';
                  coveringUnit.activeMissionId = 'return-home';
                  coveringUnit.currentRouteIndex = 0;
                  coveringUnit.routePoints = generateRoutePoints(coveringUnit.lat, coveringUnit.lon, origHomeSector.center[0], origHomeSector.center[1], null, coveringUnit.id, true);
                  coveringUnit.baseSectorId = origHomeSector.id; // Restore original base sector for IVR

                  broadcastToAll({
                    type: 'unit_telemetry',
                    payload: coveringUnit,
                    timestamp: Date.now(),
                    isSimulation: true
                  });

                  broadcastToAll({
                    type: 'system_alert',
                    payload: {
                      msg: `[SIMULACRO - RETORNO] ${coveringUnit.name} SUSPENDE COBERTURA Y RETORNA A SU BASE EN SECTOR ${origHomeSector.name}.`,
                      type: 'info'
                    },
                    timestamp: Date.now(),
                    isSimulation: true
                  });
                }
              }
            }
          }

          recalculateIvr(true);
          broadcastToAll({
            type: 'unit_telemetry',
            payload: unit,
            timestamp: Date.now(),
            isSimulation: true
          });
        }
      }
    });
  }
}, 4000); // progressive ticker

// Dead man's switch initialization and execution
function startDeadManSwitch(reportId: string) {
  if (activeDeadManSwitches.has(reportId)) return;

  const timeLeft = 60; // 60 seconds strict safety timer
  const interval = setInterval(() => {
    const dms = activeDeadManSwitches.get(reportId);
    if (!dms) return;

    dms.timeLeft -= 1;

    // Broadcast countdown tick
    broadcastToAll({
      type: 'dead_man_tick',
      payload: { reportId, timeLeft: dms.timeLeft },
      timestamp: Date.now(),
      isSimulation: false
    });

    if (dms.timeLeft <= 0) {
      // Trigger "Silent Commit" autonomous dispatch
      triggerDeadManDispatch(reportId);
    }
  }, 1000);

  activeDeadManSwitches.set(reportId, { reportId, timeLeft, interval });
}

function clearDeadManSwitch(reportId: string) {
  const dms = activeDeadManSwitches.get(reportId);
  if (dms) {
    clearInterval(dms.interval);
    activeDeadManSwitches.delete(reportId);
    broadcastToAll({
      type: 'dead_man_reset',
      payload: { reportId },
      timestamp: Date.now(),
      isSimulation: false
    });
  }
}

function executeUnitDispatch(reportId: string, unitId: string, isSim: boolean) {
  const dbReports = isSim ? drillManager.reports : reports;
  const dbUnits = isSim ? drillManager.units : units;

  const rep = dbReports.find((r) => r.id === reportId);
  const unit = dbUnits.find((u) => u.id === unitId);

  if (rep && unit && unit.status === 'available') {
    rep.status = 'dispatched';
    rep.assignedUnitId = unit.id;

    unit.status = 'dispatched';
    unit.activeMissionId = rep.id;
    unit.currentRouteIndex = 0;
    unit.hasAutoReRoutedForTraffic = false;
    unit.trafficDelay = false;

    // FIND OPTIMAL ROUTE BEFORE DEPARTURE (PRE-DEPARTURE ROUTE OPTIMIZATION)
    let preDispatchBlockedCoord: [number, number] | null = null;
    let preDispatchBlockageReason = '';

    // Check if standard route points intercept with any existing active unresolved incidents
    const standardRoute = generateLocalFallbackRoute(unit.lat, unit.lon, rep.lat, rep.lon, null);
    for (const obstacle of dbReports) {
      if (obstacle.id === rep.id || obstacle.status === 'resolved') continue;

      const isBlocking = standardRoute.some((p) => {
        const dist = getHaversineDistance(p[0], p[1], obstacle.lat, obstacle.lon);
        return dist < 0.25; // 250m proximity congestion boundary
      });

      if (isBlocking) {
        preDispatchBlockedCoord = [obstacle.lat, obstacle.lon];
        preDispatchBlockageReason = obstacle.description || (isSim ? 'incidente simulado' : 'active incident');
        break;
      }
    }

    if (preDispatchBlockedCoord) {
      // Set bypass detour on departure
      unit.routePoints = generateRoutePoints(unit.lat, unit.lon, rep.lat, rep.lon, preDispatchBlockedCoord, unit.id, isSim);
      
      // Notify client/trainee via real-time satellite co-pilot alert
      broadcastToAll({
        type: 'system_alert',
        payload: {
          msg: isSim
            ? `[SIMULACRO] 🚀 PRE-PLANIFICACIÓN: ¡Ruta de salida de ${unit.name} re-calculada antes de partir! Desvío óptimo para evadir embotellamiento crítico en ${preDispatchBlockageReason.substring(0, 35)}.`
            : `🚀 PRE-DEPARTURE ROUTING: ${unit.name} route pre-optimized to bypass traffic corridor near ${preDispatchBlockageReason.substring(0, 35)} before leaving.`,
          type: 'info'
        },
        timestamp: Date.now(),
        isSimulation: isSim
      });
    } else {
      // Standard direct path
      unit.routePoints = generateRoutePoints(unit.lat, unit.lon, rep.lat, rep.lon, null, unit.id, isSim);
    }

    if (isSim) {
      drillManager.recordDispatch(reportId);
      recalculateIvr(true);
    } else {
      // Reset Dead-Man's safety switch upon dispatch
      clearDeadManSwitch(reportId);
      recalculateIvr(false);
    }

    broadcastToAll({
      type: 'emergency_updated',
      payload: rep,
      timestamp: Date.now(),
      isSimulation: isSim
    });

    broadcastToAll({
      type: 'unit_telemetry',
      payload: unit,
      timestamp: Date.now(),
      isSimulation: isSim
    });

    // ----------------------------------------------------
    // DYNAMIC COVERAGE REDEPLOYMENT (COBERTURA DINÁMICA)
    // ----------------------------------------------------
    const homeSecId = unit.baseSectorId;
    if (homeSecId) {
      const activeSectors = isSim ? drillManager.sectors : sectors;
      const homeSec = activeSectors.find(s => s.id === homeSecId);
      
      const sameTypeAvailableInHome = dbUnits.filter(
        (u) => u.baseSectorId === homeSecId && u.status === 'available' && u.type === unit.type
      );

      if (sameTypeAvailableInHome.length === 0 && homeSec) {
        // The sector is now vacant of this resource type!
        // Look for another station with backups, or any other station with an available resource
        let bestCoveringUnit: FleetUnit | null = null;
        let bestPriority = 3; // 1 = backup station, 2 = single station, 3 = none
        let minDist = 999999;

        dbUnits.forEach((ou) => {
          if (ou.status === 'available' && ou.type === unit.type && ou.baseSectorId && ou.baseSectorId !== homeSecId) {
            const backupCount = dbUnits.filter(
              (bu) => bu.baseSectorId === ou.baseSectorId && bu.status === 'available' && bu.type === ou.type
            ).length;

            const priority = backupCount > 1 ? 1 : 2;
            const d = getHaversineDistance(ou.lat, ou.lon, homeSec.center[0], homeSec.center[1]);
            
            if (priority < bestPriority) {
              bestPriority = priority;
              minDist = d;
              bestCoveringUnit = ou;
            } else if (priority === bestPriority && d < minDist) {
              minDist = d;
              bestCoveringUnit = ou;
            }
          }
        });

        if (bestCoveringUnit) {
          const coverUnit: FleetUnit = bestCoveringUnit;

          // Redeploy this backup unit to cover the vacant station!
          coverUnit.status = 'dispatched';
          coverUnit.activeMissionId = `cover-${homeSecId}`; // special virtual cover mission
          coverUnit.currentRouteIndex = 0;
          coverUnit.routePoints = generateRoutePoints(coverUnit.lat, coverUnit.lon, homeSec.center[0], homeSec.center[1], null, coverUnit.id, isSim);
          
          // Reassign home base to the vacant sector immediately so IVR matches!
          coverUnit.baseSectorId = homeSecId;

          if (isSim) {
            recalculateIvr(true);
          } else {
            recalculateIvr(false);
          }

          broadcastToAll({
            type: 'unit_telemetry',
            payload: coverUnit,
            timestamp: Date.now(),
            isSimulation: isSim
          });

          // Generate dynamic coverage autonomous decision report
          const distCover = getHaversineDistance(coverUnit.lat, coverUnit.lon, homeSec.center[0], homeSec.center[1]);
          const travelTimeSecCover = (distCover / 45) * 3600;
          const decision = {
            id: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            timestamp: Date.now(),
            type: 'coverage',
            unitId: coverUnit.id,
            unitName: coverUnit.name,
            triggerEvent: isSim ? 'Alerta de Estación Vacante (Simulación)' : 'Alerta de Estación Vacante (Misión Real)',
            justificationEs: `La salida de la unidad primaria ${unit.name} para responder a una emergencia dejó el sector ${homeSec.name} sin unidades de este vector. El algoritmo de optimización SOAE determinó que ${coverUnit.name} es la unidad disponible más idónea a una distancia de ${distCover.toFixed(2)} km (ETA estimado de arribo: ${(travelTimeSecCover / 60).toFixed(0)} min). Se inició su redespliegue de cobertura inmediata para mitigar el incremento proyectado del Índice de Vulnerabilidad de Respuesta (IVR).`,
            justificationEn: `The departure of primary unit ${unit.name} to respond to an emergency left sector ${homeSec.name} without any active units of this vector. The SOAE optimization algorithm determined that ${coverUnit.name} is the most suitable available unit at a distance of ${distCover.toFixed(2)} km (estimated ETA: ${(travelTimeSecCover / 60).toFixed(0)} min). Immediate coverage redeployment was initiated to mitigate the projected spike in the Response Vulnerability Index (IVR).`,
            details: {
              distance: distCover,
              estimatedTravelTime: travelTimeSecCover,
              homeStationIvrProyected: homeSec.ivr,
              alternativeOptionsScanned: dbUnits.filter(ou => ou.status === 'available' && ou.type === unit.type && ou.id !== coverUnit.id).length,
              formulaUsed: 'IVR = Risk * (2 / (2 + Sum(weights)))'
            }
          };
          autonomousDecisions.push(decision);
          broadcastToAll({
            type: 'autonomous_decision',
            payload: decision,
            timestamp: Date.now(),
            isSimulation: isSim
          });

          // Trigger system alert
          broadcastToAll({
            type: 'system_alert',
            payload: {
              msg: isSim 
                ? `[SIMULACRO - COBERTURA] ${coverUnit.name} REDESPLEGADA A SECTOR ${homeSec.name} PARA REEMPLAZAR A ${unit.name}.`
                : `[COBERTURA AUTOMÁTICA] ${coverUnit.name} REDESPLEGADA A SECTOR ${homeSec.name} PARA REEMPLAZAR A ${unit.name}.`,
              type: 'info'
            },
            timestamp: Date.now(),
            isSimulation: isSim
          });
        }
      }
    }
  }
}

function triggerDeadManDispatch(reportId: string) {
  clearDeadManSwitch(reportId);

  const rep = reports.find((r) => r.id === reportId);
  if (!rep || rep.status !== 'pending') return;

  // Run MILP Autonomous Optimization
  const optResult = runDispatchOptimization(rep, false);
  const unitsToDispatch = optResult.coDeployment && optResult.coDeployment.length > 0
    ? optResult.coDeployment.map(cd => cd.unit)
    : (optResult.optimalUnit ? [optResult.optimalUnit] : []);

  if (unitsToDispatch.length > 0) {
    // Execute the dispatch and handle automatic dynamic coverage!
    unitsToDispatch.forEach(unit => {
      executeUnitDispatch(reportId, unit.id, false);
    });

    const primaryUnit = unitsToDispatch[0];
    const overrideReason = optResult.isLocked 
      ? 'Silent Commit: Autonomous satellite override bypassed Minimum Safety Lock to secure life preservation.'
      : 'Silent Commit triggered automatically due to human dispatcher inactivity.';

    broadcastToAll({
      type: 'dead_man_triggered',
      payload: {
        report: rep,
        unit: primaryUnit,
        reasons: [overrideReason]
      },
      timestamp: Date.now(),
      isSimulation: false
    });

    // Generate autonomous silent-commit decision report
    const dist = getHaversineDistance(primaryUnit.lat, primaryUnit.lon, rep.lat, rep.lon);
    let avgSpeed = 45;
    if (primaryUnit.type === 'ambulance') avgSpeed = 55;
    if (primaryUnit.type === 'fire_truck') avgSpeed = 48;
    if (primaryUnit.type === 'heavy_rescue') avgSpeed = 40;
    const travelTimeSec = (dist / avgSpeed) * 3600;
    const survivalRate = 100 * Math.exp(-0.0012 * travelTimeSec);

    const unitNames = unitsToDispatch.map(u => u.name).join(', ');
    const decision = {
      id: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type: 'dispatch',
      unitId: primaryUnit.id,
      unitName: primaryUnit.name,
      triggerEvent: 'Silent Commit (Inactividad del Operador - 60s)',
      justificationEs: `Al agotarse el temporizador de resguardo de 60 segundos debido a inacción del operador de guardia en el incidente crítico ${rep.id.substring(0, 6)} (${rep.type.toUpperCase()}), el núcleo satelital de seguridad SOAE activó el despacho autónomo de contingencia. El optimizador lineal seleccionó a [${unitNames}] como los vehículos óptimos para resolver el incidente de forma integral (probabilidad calculada de supervivencia civil inicial: ${survivalRate.toFixed(1)}%).`,
      justificationEn: `Upon expiration of the 60-second safeguard timer due to operator inactivity on critical incident ${rep.id.substring(0, 6)} (${rep.type.toUpperCase()}), the SOAE core activated safeguard autonomous dispatch. The optimization solver selected [${unitNames}] as the optimal responders to resolve the incident comprehensively (calculated initial civil survival rate: ${survivalRate.toFixed(1)}%).`,
      details: {
        distance: dist,
        estimatedTravelTime: travelTimeSec,
        survivalRateProved: survivalRate,
        formulaUsed: 'S(t) = 100 * exp(-0.0012 * t_sec)',
        dispatchedCount: unitsToDispatch.length
      }
    };
    autonomousDecisions.push(decision);
    broadcastToAll({
      type: 'autonomous_decision',
      payload: decision,
      timestamp: Date.now(),
      isSimulation: false
    });
  }
}

// ==========================================
// 5. WEBSOCKET CONTROLLER INTERFACE
// ==========================================

wss.on('connection', (ws) => {
  console.log('Client operator terminal connected.');

  // Push immediate synchronized full-system state upon handshake
  ws.send(
    JSON.stringify({
      type: 'init_state',
      payload: {
        sectors,
        units,
        reports,
        physicalConstraints,
        drillSession: drillManager.getSession(),
        drillSectors: drillManager.sectors,
        drillUnits: drillManager.units,
        drillReports: drillManager.reports,
        activeSwitches: Array.from(activeDeadManSwitches.values()).map(v => ({ reportId: v.reportId, timeLeft: v.timeLeft })),
        autonomousDecisions: autonomousDecisions
      },
      timestamp: Date.now()
    })
  );

  ws.on('message', (messageRaw) => {
    try {
      const msg: RealtimeMessage = JSON.parse(messageRaw.toString());
      const isSim = !!msg.isSimulation;

      switch (msg.type) {
        case 'emergency_reported': {
          const reportData: EmergencyReport = msg.payload;
          
          // Guard against duplications (anti-duplicate network signature filter)
          const db = isSim ? drillManager.reports : reports;
          const duplicate = db.find(
            (r) => r.networkSignature === reportData.networkSignature
          );
          if (duplicate) {
            console.log(`Duplicate report filtered: ${reportData.networkSignature}`);
            return;
          }

          reportData.id = reportData.id || `rep-${Date.now()}`;
          reportData.status = 'pending';
          
          if (isSim) {
            drillManager.reports.push(reportData);
          } else {
            reports.push(reportData);
            // Trigger Dead Man's Switch for real-world high threat levels
            startDeadManSwitch(reportData.id);
          }

          broadcastToAll({
            type: 'emergency_reported',
            payload: reportData,
            timestamp: Date.now(),
            isSimulation: isSim
          });

          // Run active obstacle avoidance scan for active dispatched units!
          checkAndAvoidObstacles(isSim, reportData);
          break;
        }

        case 'unit_dispatched': {
          const { reportId, unitId } = msg.payload;
          executeUnitDispatch(reportId, unitId, isSim);
          break;
        }

        case 'unit_return_home': {
          const { unitId } = msg.payload;
          const dbUnits = isSim ? drillManager.units : units;
          const dbSectors = isSim ? drillManager.sectors : sectors;
          const dbReports = isSim ? drillManager.reports : reports;
          const unit = dbUnits.find((u) => u.id === unitId);

          if (unit) {
            // Reset any active incident assignment
            if (unit.activeMissionId && unit.activeMissionId.startsWith('rep-')) {
              const rep = dbReports.find(r => r.id === unit.activeMissionId);
              if (rep) {
                rep.status = 'pending';
                rep.assignedUnitId = undefined;
                broadcastToAll({
                  type: 'emergency_updated',
                  payload: rep,
                  timestamp: Date.now(),
                  isSimulation: isSim
                });
              }
            }

            const homeSecId = unit.originalBaseSectorId || unit.baseSectorId;
            const homeSector = dbSectors.find(s => s.id === homeSecId);
            if (homeSector) {
              unit.status = 'dispatched';
              unit.activeMissionId = 'return-home';
              unit.currentRouteIndex = 0;
              unit.routePoints = generateRoutePoints(unit.lat, unit.lon, homeSector.center[0], homeSector.center[1], null, unit.id, isSim);
              unit.baseSectorId = homeSector.id; // Restore original base sector

              broadcastToAll({
                type: 'unit_telemetry',
                payload: unit,
                timestamp: Date.now(),
                isSimulation: isSim
              });

              broadcastToAll({
                type: 'system_alert',
                payload: {
                  msg: isSim 
                    ? `[SIMULACRO - RETORNO] 🏠 ORDEN DE RETORNO: Ordenando a ${unit.name} retornar a su base en ${homeSector.name} con ruta óptima.`
                    : `🏠 RETURN TO BASE: Ordering ${unit.name} to return to base depot in ${homeSector.name} with fully optimized transit routing.`,
                  type: 'info'
                },
                timestamp: Date.now(),
                isSimulation: isSim
              });
            }
          }
          break;
        }

        case 'unit_route_blocked': {
          const { unitId } = msg.payload;
          const dbUnits = isSim ? drillManager.units : units;
          const dbReports = isSim ? drillManager.reports : reports;
          const unit = dbUnits.find((u) => u.id === unitId);

          if (unit && unit.status === 'dispatched' && unit.activeMissionId) {
            const rep = dbReports.find((r) => r.id === unit.activeMissionId!);
            if (rep) {
              const blockedCoord: [number, number] = unit.routePoints && unit.currentRouteIndex !== undefined
                ? unit.routePoints[unit.currentRouteIndex]
                : [unit.lat, unit.lon];

              // Force route recalculation bypassing blockedCoord
              unit.currentRouteIndex = 0;
              unit.routePoints = generateRoutePoints(unit.lat, unit.lon, rep.lat, rep.lon, blockedCoord, unit.id, isSim);
              
              if (isSim) {
                drillManager.recordRouteBlockBypass();
              }

              // Generate route blockage autonomous decision report
              const decision = {
                id: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                timestamp: Date.now(),
                type: 'reroute',
                unitId: unit.id,
                unitName: unit.name,
                triggerEvent: isSim ? 'Obstáculo en Ruta Detectado (Simulación)' : 'Obstáculo en Ruta Detectado (Misión Real)',
                justificationEs: `La unidad ${unit.name} detectó una obstrucción física, colapso vial o bloqueo en su ruta programada hacia el incidente ${rep.id.substring(0, 6)}. El motor dinámico A* recalculó instantáneamente una trayectoria alternativa evadiendo las coordenadas del bloqueo [${blockedCoord[0].toFixed(5)}, ${blockedCoord[1].toFixed(5)}] para asegurar que la unidad mantenga la menor latencia de arribo posible.`,
                justificationEn: `Unit ${unit.name} detected a physical route blockage, traffic collapse, or obstruction on its scheduled route to incident ${rep.id.substring(0, 6)}. The dynamic A* routing engine instantly recalculated an alternate path bypassing the blocked coordinates [${blockedCoord[0].toFixed(5)}, ${blockedCoord[1].toFixed(5)}] to ensure minimal response latency.`,
                details: {
                  formulaUsed: 'A* Pathfinding with Forbidden Nodes Constraint'
                }
              };
              autonomousDecisions.push(decision);
              broadcastToAll({
                type: 'autonomous_decision',
                payload: decision,
                timestamp: Date.now(),
                isSimulation: isSim
              });

              broadcastToAll({
                type: 'unit_route_blocked',
                payload: {
                  unitId,
                  blockedCoord,
                  newRoute: unit.routePoints
                },
                timestamp: Date.now(),
                isSimulation: isSim
              });

              broadcastToAll({
                type: 'unit_telemetry',
                payload: unit,
                timestamp: Date.now(),
                isSimulation: isSim
              });
            }
          }
          break;
        }

        case 'dead_man_reset': {
          const { reportId } = msg.payload;
          clearDeadManSwitch(reportId);
          break;
        }

        case 'base_station_added': {
          const payload = msg.payload;
          const isSim = !!msg.isSimulation;
          const dbSectors = isSim ? drillManager.sectors : sectors;
          const dbUnits = isSim ? drillManager.units : units;

          const newSectorId = `sec-${Date.now()}`;
          const newSector: CoverageSector = {
            id: newSectorId,
            name: payload.name || `Base Station ${dbSectors.length + 1}`,
            center: [payload.lat, payload.lon],
            baseRisk: payload.baseRisk !== undefined ? payload.baseRisk : 0.5,
            populationDensity: payload.populationDensity !== undefined ? payload.populationDensity : 10000,
            ivr: 0.0,
            polygon: [
              [payload.lat + 0.015, payload.lon - 0.015],
              [payload.lat + 0.015, payload.lon + 0.015],
              [payload.lat - 0.015, payload.lon + 0.015],
              [payload.lat - 0.015, payload.lon - 0.015]
            ]
          };

          dbSectors.push(newSector);

          // If starting units were supplied, let's add them stationed at this base
          if (payload.units && Array.isArray(payload.units)) {
            payload.units.forEach((u: any, idx: number) => {
              const unitId = `unit-${Date.now()}-${idx}`;
              dbUnits.push({
                id: unitId,
                name: u.name || `${u.type.replace('_', ' ').toUpperCase()} ${idx + 1}`,
                type: u.type,
                status: 'available',
                lat: payload.lat + (Math.random() - 0.5) * 0.002, // slightly offset so they don't stack directly
                lon: payload.lon + (Math.random() - 0.5) * 0.002,
                speed: 0,
                bearing: Math.floor(Math.random() * 360),
                batteryOrFuel: 100,
                baseSectorId: newSectorId,
                originalBaseSectorId: newSectorId
              });
            });
          }

          // Recalculate IVR dynamically
          recalculateIvr(isSim);

          // Broadcast state to everyone
          broadcastToAll({
            type: 'init_state',
            payload: {
              sectors,
              units,
              reports,
              physicalConstraints,
              drillSession: drillManager.getSession(),
              drillSectors: drillManager.sectors,
              drillUnits: drillManager.units,
              drillReports: drillManager.reports,
              activeSwitches: Array.from(activeDeadManSwitches.values()).map(v => ({ reportId: v.reportId, timeLeft: v.timeLeft })),
              autonomousDecisions: autonomousDecisions
            },
            timestamp: Date.now()
          });

          broadcastToAll({
            type: 'system_alert',
            payload: {
              msg: isSim
                ? `[SIMULACRO] 🏢 NUEVA BASE: Se ha registrado la estación ${newSector.name} con ${payload.units?.length || 0} vehículos de respuesta.`
                : `🏢 NEW BASE INSTALLED: Station ${newSector.name} has been operationalized with ${payload.units?.length || 0} tactical response vehicles.`,
              type: 'info'
            },
            timestamp: Date.now(),
            isSimulation: isSim
          });
          break;
        }

        case 'drill_started': {
          const { name, username, duration } = msg.payload;
          drillManager.startDrill(name, username, duration, sectors, units);
          break;
        }

        case 'drill_stopped': {
          drillManager.stopDrill();
          break;
        }

        case 'unit_telemetry': {
          // Manual telemetry driving (especially useful during simulator route interaction)
          const telemetry = msg.payload;
          const dbUnits = isSim ? drillManager.units : units;
          const idx = dbUnits.findIndex((u) => u.id === telemetry.id);
          if (idx !== -1) {
            dbUnits[idx] = { ...dbUnits[idx], ...telemetry };
            broadcastToAll({
              type: 'unit_telemetry',
              payload: dbUnits[idx],
              timestamp: Date.now(),
              isSimulation: isSim
            });
          }
          break;
        }

        default:
          console.warn(`Unknown WebSocket message type: ${msg.type}`);
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    console.log('Operator terminal connection dropped.');
  });
});

// ==========================================
// 6. REST CONTROLLER / API ENDPOINTS
// ==========================================

// Endpoint to run predictive simulations (stress test)
app.post('/api/simulation/test', (req, res) => {
  try {
    const config: SimulationConfig = req.body;
    
    // Count current active units to feed inventory
    const currentInventory: ResourceInventory = {
      fire_truck: units.filter(u => u.type === 'fire_truck').length,
      heavy_rescue: units.filter(u => u.type === 'heavy_rescue').length,
      ambulance: units.filter(u => u.type === 'ambulance').length,
      hazmat: units.filter(u => u.type === 'hazmat').length,
    };

    const results = runPredictiveStressTest(config, currentInventory);
    
    // Also broadcast simulation results for live widgets
    broadcastToAll({
      type: 'simulation_run',
      payload: results,
      timestamp: Date.now(),
      isSimulation: false
    });

    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to fetch recommendations from optimization solver
app.post('/api/optimization/match', (req, res) => {
  try {
    const { report, isSimulation } = req.body;
    const isSim = !!isSimulation;
    const recommendation = runDispatchOptimization(report, isSim);
    res.json(recommendation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function detectIpLocation(ip: string): Promise<{ lat: number; lon: number; regionName: string } | null> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.')) {
    return null;
  }
  
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}`);
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.status === 'success' && typeof data.lat === 'number' && typeof data.lon === 'number') {
        const city = data.city || '';
        const country = data.countryCode || data.country || '';
        const regionName = city && country ? `${city} (${country})` : (city || country || 'Detected Location');
        return { lat: data.lat, lon: data.lon, regionName };
      }
    }
  } catch (err) {
    console.warn(`ip-api.com server-side fallback failed for IP ${ip}:`, err);
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (res.ok) {
      const data: any = await res.json();
      if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const city = data.city || '';
        const country = data.country_code || data.country_name || '';
        const regionName = city && country ? `${city} (${country})` : (city || country || 'Detected Location');
        return { lat: data.latitude, lon: data.longitude, regionName };
      }
    }
  } catch (err) {
    console.warn(`ipapi.co server-side fallback failed for IP ${ip}:`, err);
  }

  return null;
}

// Get current region configuration with server-side automatic IP geolocate backup
app.get('/api/system/region', async (req, res) => {
  try {
    if (currentRegionName === 'Autodetect by GPS' || currentRegionName === 'Autodetectar por GPS') {
      const rawIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '';
      const clientIp = rawIp.split(',')[0].trim();
      console.log(`System region is in autodetect mode. Client request IP: ${clientIp}`);
      const detected = await detectIpLocation(clientIp);
      if (detected) {
        console.log(`Server-side autodetected client IP ${clientIp} location: ${detected.regionName} [${detected.lat}, ${detected.lon}]`);
        initializeSectorsAndUnits(detected.lat, detected.lon, detected.regionName);
        recalculateIvr(false);
      }
    }
  } catch (err) {
    console.warn('Background server-side IP geolocation failed:', err);
  }

  res.json({
    lat: currentBaseLat,
    lon: currentBaseLon,
    regionName: currentRegionName
  });
});

// Update region configuration and reinitialize
app.post('/api/system/region', (req, res) => {
  try {
    const { lat, lon, regionName } = req.body;
    if (typeof lat !== 'number' || typeof lon !== 'number' || !regionName) {
      return res.status(400).json({ error: 'Invalid parameters. Please supply lat, lon, and regionName.' });
    }

    initializeSectorsAndUnits(lat, lon, regionName);
    recalculateIvr(false);

    broadcastToAll({
      type: 'init_state',
      payload: {
        sectors,
        units,
        reports,
        physicalConstraints,
        drillSession: drillManager.getSession(),
        drillSectors: drillManager.sectors,
        drillUnits: drillManager.units,
        drillReports: drillManager.reports,
        activeSwitches: [],
        autonomousDecisions: autonomousDecisions
      },
      timestamp: Date.now()
    });

    res.json({ status: 'ok', lat, lon, regionName });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset System State
app.post('/api/system/reset', (req, res) => {
  if (drillManager.getSession()?.isActive) {
    drillManager.stopDrill();
  }

  // Fully reinitialize sectors, units and clear reports relative to current base coordinates (including original spawn points)
  initializeSectorsAndUnits(currentBaseLat, currentBaseLon, currentRegionName);

  recalculateIvr(false);

  broadcastToAll({
    type: 'init_state',
    payload: { sectors, units, reports, physicalConstraints, drillSession: drillManager.getSession(), activeSwitches: [], autonomousDecisions: [] },
    timestamp: Date.now()
  });

  res.json({ status: 'ok' });
});

// ==========================================
// 7. VITE MIDDLEWARE & STATIC SERVING
// ==========================================

async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[SOAE MISSION OPERATIONS ONLINE] listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Critical boot failure:', err);
});
