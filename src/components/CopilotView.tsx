/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { FleetUnit, EmergencyReport } from '../types';
import {
  ShieldAlert,
  Navigation,
  Compass,
  AlertTriangle,
  Flame,
  Activity,
  Biohazard,
  Battery,
  RotateCw,
  Sliders,
  Play,
  CheckCircle,
  HelpCircle,
  Check,
  XCircle,
  Clock,
  Sparkles,
  AlertCircle,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  Volume2,
  VolumeX
} from 'lucide-react';

function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function generateAlternateRoutePoints(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  type: 'alpha' | 'beta' | 'gamma'
): [number, number][] {
  const points: [number, number][] = [];

  const steps = type === 'gamma' ? 10 : 6;

  const dLat = endLat - startLat;
  const dLon = endLon - startLon;
  const length = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
  const perpLat = -dLon / length;
  const perpLon = dLat / length;

  let offsetAmplitude = 0;
  if (type === 'alpha') offsetAmplitude = -0.0012;
  if (type === 'beta') offsetAmplitude = 0.0012;
  if (type === 'gamma') offsetAmplitude = 0.0028;

  let currentLat = startLat;
  let currentLon = startLon;
  points.push([currentLat, currentLon]);

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const targetLat = startLat + (endLat - startLat) * t;
    const targetLon = startLon + (endLon - startLon) * t;

    if (type === 'alpha') {
      if (i % 2 === 1) {
        currentLat = targetLat;
      } else {
        currentLon = targetLon;
      }
    } else {
      if (i % 2 === 1) {
        currentLon = targetLon;
      } else {
        currentLat = targetLat;
      }
    }

    const detourFactor = Math.sin(t * Math.PI);
    const finalLat = currentLat + perpLat * offsetAmplitude * detourFactor;
    const finalLon = currentLon + perpLon * offsetAmplitude * detourFactor;

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

const fetchRealWorldRouteForCopilot = async (
  unitId: string,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  type: 'alpha' | 'beta' | 'gamma',
  onUpdateTelemetry: (unitId: string, data: any) => void
) => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLon},${startLat};${endLon},${endLat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    const coords = data.routes?.[0]?.geometry?.coordinates;
    if (coords && coords.length > 0) {
      let points: [number, number][] = coords.map((c: any) => [c[1], c[0]]);

      const dLat = endLat - startLat;
      const dLon = endLon - startLon;
      const length = Math.sqrt(dLat * dLat + dLon * dLon) || 1;
      const perpLat = -dLon / length;
      const perpLon = dLat / length;

      let offsetAmplitude = 0;
      if (type === 'alpha') offsetAmplitude = -0.0008;
      if (type === 'beta') offsetAmplitude = 0;
      if (type === 'gamma') offsetAmplitude = 0.0016;

      if (offsetAmplitude !== 0) {
        points = points.map((p, idx) => {
          const t = idx / (points.length - 1);
          const detourFactor = Math.sin(t * Math.PI);
          return [
            p[0] + perpLat * offsetAmplitude * detourFactor,
            p[1] + perpLon * offsetAmplitude * detourFactor
          ];
        });
      }

      points[0] = [startLat, startLon];
      points[points.length - 1] = [endLat, endLon];

      onUpdateTelemetry(unitId, {
        routePoints: points,
        currentRouteIndex: 0
      });
    }
  } catch (err: any) {
    console.log('OSRM fetch for copilot failed, fallback route remains:', err.message);
  }
};

interface NavigationStep {
  instruction: string;
  distance: string;
  type: 'straight' | 'left' | 'right' | 'arrival' | 'start';
  isCongested?: boolean;
}

function getNavigationSteps(points: [number, number][], lang: 'es' | 'en', reports: EmergencyReport[] = []): NavigationStep[] {
  if (!points || points.length === 0) return [];

  const steps: NavigationStep[] = [];
  
  // Add starting step
  steps.push({
    instruction: lang === 'es' ? 'Centro de Despacho: Inicio de despliegue de ruta' : 'Dispatch Center: Initiating tactical route deployment',
    distance: '0 m',
    type: 'start'
  });

  const totalPoints = points.length;
  if (totalPoints > 2) {
    // We want to sample ~4-5 distinctive intervals along the route points
    const stepCount = 5;
    const interval = Math.floor(totalPoints / (stepCount + 1)) || 1;

    for (let i = 1; i <= stepCount; i++) {
      const idx = i * interval;
      if (idx >= totalPoints - 1) break;

      const p1 = points[idx - 1];
      const p2 = points[idx];
      const p3 = points[idx + 1];

      // Cross product to find vector turn orientation
      const v1x = p2[1] - p1[1];
      const v1y = p2[0] - p1[0];
      const v2x = p3[1] - p2[1];
      const v2y = p3[0] - p2[0];
      const crossProduct = v1x * v2y - v1y * v2x;

      let type: 'straight' | 'left' | 'right' = 'straight';
      if (crossProduct > 0.0000002) {
        type = 'left';
      } else if (crossProduct < -0.0000002) {
        type = 'right';
      }

      // Generate dynamic realistic local names based on latitude/longitude hash values
      const streets = lang === 'es' 
        ? ['Av. Central', 'Paseo de la Reforma', 'Anillo Periférico', 'Calzada de Tlalpan', 'Eje Central', 'Avenida Insurgentes', 'Av. Juárez', 'Av. Chapultepec', 'Av. Patriotismo']
        : ['Main Avenue', 'Grand Highway', 'Peripheral Loop', 'North Boulevard', 'Central Bypass', 'Sunset Way', 'Metro Expressway', 'Aviation Road', 'Ocean Avenue'];
        
      const streetIndex = Math.abs(Math.floor((p2[0] + p2[1]) * 1500)) % streets.length;
      const streetName = streets[streetIndex];

      let instruction = '';
      if (type === 'left') {
        instruction = lang === 'es' ? `Gire a la izquierda en ${streetName}` : `Turn left onto ${streetName}`;
      } else if (type === 'right') {
        instruction = lang === 'es' ? `Gire a la derecha en ${streetName}` : `Turn right onto ${streetName}`;
      } else {
        instruction = lang === 'es' ? `Continúe recto por ${streetName}` : `Continue straight on ${streetName}`;
      }

      // Check if this waypoint is in an active traffic zone (within 250m of an active incident)
      const isCongested = reports.some(r => r.status !== 'resolved' && getHaversineDistance(p2[0], p2[1], r.lat, r.lon) < 0.25);

      steps.push({
        instruction,
        distance: `${Math.round(idx * 75)} m`,
        type,
        isCongested
      });
    }
  }

  // Add arrival step
  steps.push({
    instruction: lang === 'es' ? 'Zona del Incidente: Arribo y despliegue del perímetro de emergencia' : 'Incident Zone: Arrived and establishing emergency perimeter',
    distance: lang === 'es' ? 'Destino' : 'Destination',
    type: 'arrival'
  });

  return steps;
}

interface CopilotViewProps {
  units: FleetUnit[];
  reports: EmergencyReport[];
  onTriggerRouteBlocked: (unitId: string) => void;
  onUpdateTelemetry: (unitId: string, telemetry: Partial<FleetUnit>) => void;
  isSimulation?: boolean;
  lang?: 'es' | 'en';
}

export default function CopilotView({
  units,
  reports,
  onTriggerRouteBlocked,
  onUpdateTelemetry,
  isSimulation = false,
  lang = 'es',
}: CopilotViewProps) {
  // Select which unit's co-pilot tablet is being viewed
  const dispatchedOrAvailableUnits = units.filter(u => !u.isSimulation || isSimulation);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    dispatchedOrAvailableUnits[0]?.id || ''
  );

  // Help Overlay states
  const [showRouteBlockedHelp, setShowRouteBlockedHelp] = useState<boolean>(false);
  const [showGpsHelp, setShowGpsHelp] = useState<boolean>(false);

  // Voice Guidance (Speech Synthesis) state
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(true);
  const lastAnnouncedStepRef = useRef<string>('');

  const activeUnit = units.find((u) => u.id === selectedUnitId) || dispatchedOrAvailableUnits[0];

  // Calculated route metrics
  const totalRoutePoints = activeUnit?.routePoints?.length || 0;
  const currentIdx = activeUnit?.currentRouteIndex ?? 0;
  const routeProgressPercent = totalRoutePoints > 0 ? (currentIdx / (totalRoutePoints - 1)) * 100 : 0;

  const remainingWaypoints = totalRoutePoints - currentIdx - 1;
  const etaSeconds = remainingWaypoints > 0 ? remainingWaypoints * 12 : 0;
  const etaFormatted = remainingWaypoints > 0 
    ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s` 
    : (lang === 'es' ? 'LLEGADO' : 'ARRIVED');

  const navSteps = activeUnit?.routePoints ? getNavigationSteps(activeUnit.routePoints, lang, reports) : [];
  const activeStepIdx = totalRoutePoints > 0 
    ? Math.min(Math.floor((currentIdx / totalRoutePoints) * navSteps.length), navSteps.length - 1) 
    : 0;

  // Voice alert synthesis hook
  useEffect(() => {
    if (!voiceEnabled || !activeUnit || activeUnit.status !== 'dispatched' || navSteps.length === 0) {
      return;
    }

    const step = navSteps[activeStepIdx];
    if (!step) return;

    // Create a unique key for this step of this unit to avoid double speaking
    const announcementKey = `${activeUnit.id}-${activeStepIdx}-${step.instruction}`;

    if (lastAnnouncedStepRef.current !== announcementKey) {
      lastAnnouncedStepRef.current = announcementKey;

      let speakText = '';
      
      if (step.isCongested) {
        if (lang === 'es') {
          speakText = `Atención copiloto, se aproxima a un punto de bloqueo crítico en ${step.distance}. Se requiere cambio de carril inmediato para evadir el embotellamiento.`;
        } else {
          speakText = `Attention copilot, approaching a critical blockage point in ${step.distance}. Immediate lane change required to evade gridlock.`;
        }
      } else if (step.type === 'left' || step.type === 'right') {
        if (lang === 'es') {
          speakText = `Aviso de guiado. Se requiere cambio de carril para preparar maniobra. En ${step.distance}, ${step.instruction.toLowerCase()}.`;
        } else {
          speakText = `Guidance alert. Lane change required to prepare for maneuver. In ${step.distance}, ${step.instruction.toLowerCase()}.`;
        }
      } else if (step.type === 'arrival') {
        if (lang === 'es') {
          speakText = `Alerta de misión. Hemos arribado con éxito al punto de destino. Despliegue el perímetro de emergencia.`;
        } else {
          speakText = `Mission alert. Successfully arrived at the destination. Deploy emergency perimeter.`;
        }
      } else if (step.type === 'start') {
        if (lang === 'es') {
          speakText = `Despacho satelital iniciado para la unidad ${activeUnit.name}. Iniciando guiado automático.`;
        } else {
          speakText = `Satellite dispatch initiated for unit ${activeUnit.name}. Activating auto guidance.`;
        }
      }

      if (speakText && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(speakText);
          utterance.lang = lang === 'es' ? 'es-ES' : 'en-US';
          utterance.rate = 1.0;
          utterance.pitch = 1.05; // Slightly clear tactical voice
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          console.error('Speech synthesis execution failed:', e);
        }
      }
    }
  }, [selectedUnitId, activeStepIdx, activeUnit?.status, voiceEnabled, lang, navSteps]);

  // Real-time Route Optimization state
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluationProgress, setEvaluationProgress] = useState<number>(0);
  const [currentEvaluationStep, setCurrentEvaluationStep] = useState<string>('');
  const [lastEvaluatedMissionId, setLastEvaluatedMissionId] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('beta');

  // Find assigned emergency report
  const assignedEmergency = reports.find(
    (r) => r.id === activeUnit?.activeMissionId && r.status !== 'resolved'
  );

  // Auto trigger route scanner on new mission
  useEffect(() => {
    if (assignedEmergency && assignedEmergency.id !== lastEvaluatedMissionId) {
      setLastEvaluatedMissionId(assignedEmergency.id);
      setIsEvaluating(true);
      setEvaluationProgress(0);
      setSelectedRouteId('beta'); // Route Beta is the mathematically optimal one
      
      let progress = 0;
      const steps = lang === 'es' ? [
        'Trazando vectores espaciales de trayectoria (Alfa, Beta, Gamma, Delta)...',
        'Evaluando coeficientes de flujo vehicular (Ruta Alfa)...',
        'Analizando restricciones por reparaciones / pavimentación (Ruta Gamma)...',
        'Detectando bloqueo hidráulico por inundación activa (Ruta Delta)...',
        'Corriendo optimizador heurístico de tiempo mínimo (ETA)...',
        'Sincronizando ruta óptima "Beta" con el sistema de guiado GPS...'
      ] : [
        'Mapping spatial trajectory vectors (Alpha, Beta, Gamma, Delta)...',
        'Evaluating traffic flow coefficients (Route Alpha)...',
        'Analyzing road repairs / paving restrictions (Route Gamma)...',
        'Detecting active hydraulic flood blockage (Route Delta)...',
        'Running heuristic minimum time optimizer (ETA)...',
        'Syncing optimal route "Beta" with GPS guidance system...'
      ];

      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setIsEvaluating(false);

          // Apply Route Beta points automatically when evaluation completes
          if (activeUnit) {
            const startLat = activeUnit.lat;
            const startLon = activeUnit.lon;
            const endLat = assignedEmergency.lat;
            const endLon = assignedEmergency.lon;
            const betaPoints = generateAlternateRoutePoints(startLat, startLon, endLat, endLon, 'beta');
            onUpdateTelemetry(activeUnit.id, {
              routePoints: betaPoints,
              currentRouteIndex: 0
            });
            fetchRealWorldRouteForCopilot(activeUnit.id, startLat, startLon, endLat, endLon, 'beta', onUpdateTelemetry);
          }
        }
        setEvaluationProgress(progress);
        const stepIdx = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));
        setCurrentEvaluationStep(steps[stepIdx]);
      }, 150);

      return () => clearInterval(interval);
    }
  }, [assignedEmergency?.id, activeUnit?.id, lastEvaluatedMissionId]);

  const handleTriggerReevaluation = () => {
    if (!assignedEmergency) return;
    setIsEvaluating(true);
    setEvaluationProgress(0);
    
    let progress = 0;
    const steps = lang === 'es' ? [
      'Reiniciando red de trayectorias secundarias...',
      'Escaneando sensores viales locales...',
      'Recalculando matriz de demoras por congestión...',
      'Confirmando estado operativo de vías primarias...',
      'Heurística terminada. Determinando ruta óptima...'
    ] : [
      'Reinitializing secondary trajectory network...',
      'Scanning local road telemetry sensors...',
      'Recalculating congestion delay matrix...',
      'Confirming operational status of primary vectors...',
      'Heuristic complete. Identifying optimal path...'
    ];

    const interval = setInterval(() => {
      progress += 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setIsEvaluating(false);
        
        // Apply selected route points (whichever is highlighted)
        if (activeUnit) {
          const startLat = activeUnit.lat;
          const startLon = activeUnit.lon;
          const endLat = assignedEmergency.lat;
          const endLon = assignedEmergency.lon;
          const targetPoints = generateAlternateRoutePoints(startLat, startLon, endLat, endLon, selectedRouteId as 'alpha' | 'beta' | 'gamma');
          onUpdateTelemetry(activeUnit.id, {
            routePoints: targetPoints,
            currentRouteIndex: 0
          });
          fetchRealWorldRouteForCopilot(activeUnit.id, startLat, startLon, endLat, endLon, selectedRouteId as 'alpha' | 'beta' | 'gamma', onUpdateTelemetry);
        }
      }
      setEvaluationProgress(progress);
      const stepIdx = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length));
      setCurrentEvaluationStep(steps[stepIdx]);
    }, 200);
  };

  // Auto-Route Simulation State & Ref
  const [autoRouteIntervalId, setAutoRouteIntervalId] = useState<any>(null);
  const [autoRoutingUnitId, setAutoRoutingUnitId] = useState<string | null>(null);
  const latestActiveUnitRef = useRef(activeUnit);

  useEffect(() => {
    latestActiveUnitRef.current = activeUnit;
  }, [activeUnit]);

  // Clear interval on unit change or unmount
  useEffect(() => {
    if (autoRouteIntervalId && autoRoutingUnitId !== activeUnit?.id) {
      clearInterval(autoRouteIntervalId);
      setAutoRouteIntervalId(null);
      setAutoRoutingUnitId(null);
    }
  }, [selectedUnitId]);

  useEffect(() => {
    return () => {
      if (autoRouteIntervalId) {
        clearInterval(autoRouteIntervalId);
      }
    };
  }, [autoRouteIntervalId]);

  const handleToggleAutoRoute = () => {
    if (!activeUnit) return;
    const totalPoints = activeUnit.routePoints?.length || 0;

    if (autoRoutingUnitId === activeUnit.id) {
      // Pause
      if (autoRouteIntervalId) {
        clearInterval(autoRouteIntervalId);
        setAutoRouteIntervalId(null);
      }
      setAutoRoutingUnitId(null);
      onUpdateTelemetry(activeUnit.id, { speed: 0 });
    } else {
      if (activeUnit.status !== 'dispatched' || !activeUnit.routePoints || totalPoints === 0) {
        return;
      }

      setAutoRoutingUnitId(activeUnit.id);

      const interval = setInterval(() => {
        const u = latestActiveUnitRef.current;
        if (!u || u.status !== 'dispatched' || !u.routePoints) {
          clearInterval(interval);
          setAutoRouteIntervalId(null);
          setAutoRoutingUnitId(null);
          return;
        }

        const currentPoints = u.routePoints.length;
        const currentIdx = u.currentRouteIndex ?? 0;

        if (currentIdx >= currentPoints - 1) {
          clearInterval(interval);
          setAutoRouteIntervalId(null);
          setAutoRoutingUnitId(null);
          onUpdateTelemetry(u.id, { speed: 0 });
          return;
        }

        // Randomly advance by 1 to 3 waypoints
        const step = Math.floor(Math.random() * 3) + 1;
        const nextIdx = Math.min(currentPoints - 1, currentIdx + step);
        const [targetLat, targetLon] = u.routePoints[nextIdx];

        onUpdateTelemetry(u.id, {
          currentRouteIndex: nextIdx,
          lat: targetLat,
          lon: targetLon,
          speed: nextIdx === currentPoints - 1 ? 0 : 50 + Math.random() * 20,
        });

        if (nextIdx === currentPoints - 1) {
          clearInterval(interval);
          setAutoRouteIntervalId(null);
          setAutoRoutingUnitId(null);
        }
      }, 1000);

      setAutoRouteIntervalId(interval);
    }
  };

  if (!activeUnit) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs uppercase bg-slate-950 p-6 border border-slate-800 rounded-xl">
        {lang === 'es' ? 'Sin unidades disponibles en el sector táctico.' : 'No units available in the tactical sector.'}
      </div>
    );
  }

  // Pre-calculate routes for display
  let routesData: any[] = [];
  let optimalRouteName = '';
  let responseSavingsStr = '';

  if (assignedEmergency && activeUnit) {
    const startLat = activeUnit.lat;
    const startLon = activeUnit.lon;
    const endLat = assignedEmergency.lat;
    const endLon = assignedEmergency.lon;
    const dLat = endLat - startLat;
    const dLon = endLon - startLon;
    const distanceKm = Math.sqrt(dLat * dLat + dLon * dLon) * 111.32;

    const routeAlphaDistance = distanceKm * 1.05;
    const routeBetaDistance = distanceKm * 1.30;
    const routeGammaDistance = distanceKm * 0.95;

    // Calculate times
    // Route Alpha (Central Ave) -> traffic (Heavy traffic) -> Average speed 32 km/h
    const alphaBase = Math.round((routeAlphaDistance / 32) * 3600);
    const alphaDelay = 180; // seconds
    const alphaTotal = alphaBase + alphaDelay;

    // Route Beta (Highway) -> clear -> Average speed 72 km/h
    const betaBase = Math.round((routeBetaDistance / 72) * 3600);
    const betaDelay = 0;
    const betaTotal = betaBase + betaDelay;

    // Route Gamma (Lateral) -> construction -> Average speed 25 km/h
    const gammaBase = Math.round((routeGammaDistance / 25) * 3600);
    const gammaDelay = 320; // heavy road repairs
    const gammaTotal = gammaBase + gammaDelay;

    routesData = [
      {
        id: 'alpha',
        name: lang === 'es' ? 'Ruta Alfa (Av. Constitución)' : 'Route Alpha (Constitucion Ave)',
        distance: routeAlphaDistance,
        condition: 'traffic',
        conditionLabel: lang === 'es' ? 'Tráfico Pesado' : 'Heavy Traffic',
        baseTime: alphaBase,
        delay: alphaDelay,
        totalTime: alphaTotal,
        speed: 32,
        points: generateAlternateRoutePoints(startLat, startLon, endLat, endLon, 'alpha')
      },
      {
        id: 'beta',
        name: lang === 'es' ? 'Ruta Beta (Autopista de Enlace)' : 'Route Beta (Link Highway)',
        distance: routeBetaDistance,
        condition: 'clear',
        conditionLabel: lang === 'es' ? 'Vía Despejada' : 'Clear Vector',
        baseTime: betaBase,
        delay: betaDelay,
        totalTime: betaTotal,
        speed: 72,
        points: generateAlternateRoutePoints(startLat, startLon, endLat, endLon, 'beta')
      },
      {
        id: 'gamma',
        name: lang === 'es' ? 'Ruta Gamma (Cruce Residencial)' : 'Route Gamma (Residential Way)',
        distance: routeGammaDistance,
        condition: 'construction',
        conditionLabel: lang === 'es' ? 'En Obras / Desvío' : 'Roadwork / Detour',
        baseTime: gammaBase,
        delay: gammaDelay,
        totalTime: gammaTotal,
        speed: 25,
        points: generateAlternateRoutePoints(startLat, startLon, endLat, endLon, 'gamma')
      },
      {
        id: 'delta',
        name: lang === 'es' ? 'Ruta Delta (Bajo Nivel Subterráneo)' : 'Route Delta (Subterranean Underpass)',
        distance: distanceKm * 1.10,
        condition: 'blocked',
        conditionLabel: lang === 'es' ? 'Bloqueo / Inundación' : 'Blocked / Flooded',
        baseTime: 0,
        delay: 0,
        totalTime: Infinity,
        speed: 0,
        points: []
      }
    ];

    // Find the non-blocked route with minimum totalTime
    const validRoutes = routesData.filter(r => r.totalTime !== Infinity);
    let minRoute = validRoutes[0];
    for (let r of validRoutes) {
      if (r.totalTime < minRoute.totalTime) {
        minRoute = r;
      }
    }

    if (minRoute) {
      optimalRouteName = minRoute.name;
      // Calculate how much time we saved compared to second best or worst
      const alphaVsBeta = alphaTotal - betaTotal;
      const minutes = Math.floor(alphaVsBeta / 60);
      const seconds = alphaVsBeta % 60;
      responseSavingsStr = lang === 'es' 
        ? `Ahorra ${minutes}m ${seconds}s de tiempo de respuesta comparado con la Ruta Alfa (evita embotellamiento).`
        : `Saves ${minutes}m ${seconds}s response time compared to Route Alpha (bypasses heavy gridlock).`;
    }
  }

  // Compute vector color
  let vectorColor = 'text-sky-400 border-sky-500/30 bg-sky-500/10';
  let vectorIcon = <Activity className="w-5 h-5 text-sky-400" />;
  if (assignedEmergency) {
    if (assignedEmergency.type === 'fire') {
      vectorColor = 'text-orange-500 border-orange-500/30 bg-orange-500/10';
      vectorIcon = <Flame className="w-5 h-5 text-orange-400" />;
    } else if (assignedEmergency.type === 'chemical') {
      vectorColor = 'text-purple-400 border-purple-500/30 bg-purple-500/10';
      vectorIcon = <Biohazard className="w-5 h-5 text-purple-400" />;
    } else if (assignedEmergency.type === 'landslide') {
      vectorColor = 'text-amber-600 border-amber-600/30 bg-amber-600/10';
      vectorIcon = <AlertTriangle className="w-5 h-5 text-amber-500" />;
    }
  }

  // Route and progress metrics are now declared at the top of the component to support real-time SpeechSynthesis alerts.

  // Handle manual slider for GPS in training mode
  const handleGpsProgressChange = (val: number) => {
    if (!activeUnit.routePoints || totalRoutePoints === 0) return;
    
    const targetIdx = Math.round((val / 100) * (totalRoutePoints - 1));
    const [targetLat, targetLon] = activeUnit.routePoints[targetIdx];

    onUpdateTelemetry(activeUnit.id, {
      currentRouteIndex: targetIdx,
      lat: targetLat,
      lon: targetLon,
      speed: targetIdx === totalRoutePoints - 1 ? 0 : 45 + Math.random() * 15,
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] border-2 border-[#00FF41]/30 overflow-hidden font-mono relative text-[#00FF41]">
      {/* 1. TOP MILITARY TERMINAL HEADER */}
      <header className="bg-[#0a0a0a] border-b border-[#00FF41]/30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6 text-[#00FF41] animate-pulse" />
          <div>
            <h2 className="text-[10px] text-[#00FF41]/60 font-bold tracking-wider uppercase">
              {lang === 'es' ? 'TABLERO TÁCTICO MÓVIL // UNIT_SCREEN' : 'MOBILE TACTICAL BOARD // UNIT_SCREEN'}
            </h2>
            <div className="text-white text-base font-black tracking-tight uppercase flex items-center gap-2">
              <span>{activeUnit.name}</span>
              <span className={`text-[10px] px-2 py-0.5 border font-bold ${
                activeUnit.status === 'dispatched' ? 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/40' : 'bg-black text-[#00FF41]/50 border-[#00FF41]/10'
              }`}>
                {activeUnit.status === 'dispatched'
                  ? (lang === 'es' ? 'DESPACHADO' : 'DISPATCHED')
                  : (lang === 'es' ? 'EN GUARDIA' : 'ON STANDBY')}
              </span>
            </div>
          </div>
        </div>

        {/* Actions header group: voice toggle + unit switcher */}
        <div className="flex items-center gap-4">
          {/* Voice Guidance Toggle */}
          <button
            onClick={() => {
              const nextVal = !voiceEnabled;
              setVoiceEnabled(nextVal);
              if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                if (nextVal) {
                  const msg = lang === 'es' ? 'Guía de voz del copiloto activada.' : 'Copilot voice guidance activated.';
                  const ut = new SpeechSynthesisUtterance(msg);
                  ut.lang = lang === 'es' ? 'es-ES' : 'en-US';
                  window.speechSynthesis.speak(ut);
                }
              }
            }}
            title={lang === 'es' ? 'Alternar guía de voz del copiloto' : 'Toggle copilot voice guidance'}
            className={`p-2 border transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bold text-xxs uppercase ${
              voiceEnabled
                ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41] shadow-[0_0_8px_#00FF41]/20'
                : 'bg-black border-stone-800 text-stone-600 hover:border-stone-700'
            }`}
          >
            {voiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{lang === 'es' ? 'Guía de Voz' : 'Voice Guide'}</span>
          </button>

          {/* Tactical unit switcher */}
          <div className="flex items-center gap-2">
            <label className="text-xxs text-[#00FF41]/60 uppercase">
              {lang === 'es' ? 'Canal de Unidad:' : 'Unit Channel:'}
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="bg-[#050505] text-[#00FF41] text-xs font-bold border border-[#00FF41]/30 px-3 py-1.5 focus:outline-none focus:border-[#00FF41] rounded-none cursor-pointer"
            >
              {dispatchedOrAvailableUnits.map((u) => {
                const prefix = u.type === 'fire_truck' ? '🚒' : u.type === 'heavy_rescue' ? '🚛' : u.type === 'hazmat' ? '☣️' : '🚑';
                return (
                  <option key={u.id} value={u.id}>
                    {prefix} {u.name} ({u.type.replace('_', ' ').toUpperCase()})
                  </option>
                );
              })}
            </select>
          </div>
        </div>
      </header>

      {/* 2. SANDBOX WATERMARK */}
      {isSimulation && (
        <div className="bg-[#FF4444]/10 border-b border-[#FF4444]/40 px-4 py-1.5 text-center select-none animate-pulse">
          <span className="text-[#FF4444] text-xs font-black tracking-widest uppercase">
            {lang === 'es'
              ? '⚠️ ENTORNO AISLADO - MODO SIMULACRO ACTIVO - COOPERATIVO 1:1 ⚠️'
              : '⚠️ ISOLATED ENVIRONMENT - DRILL MODE ACTIVE - 1:1 COOPERATIVE ⚠️'}
          </span>
        </div>
      )}

      {/* 3. MAIN TERMINAL GRID */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 overflow-y-auto bg-[#020202]">
        
        {/* LEFT PANEL: ACTIVE MISSION DETAILS (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Mission Status card */}
          <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-4 flex flex-col gap-3">
            <div className="text-xxs text-[#00FF41]/60 font-bold border-b border-[#00FF41]/20 pb-2 flex justify-between">
              <span>{lang === 'es' ? 'ESTADO DE MISIÓN ASIGNADA' : 'ASSIGNED MISSION STATUS'}</span>
              <span className="text-[#00FF41]">ID: {activeUnit.id}</span>
            </div>

            {assignedEmergency ? (
              <div className="flex flex-col gap-3">
                <div className={`flex items-center gap-2.5 p-2.5 border ${vectorColor}`}>
                  {vectorIcon}
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide">
                      {lang === 'es' ? `AMENAZA: ${assignedEmergency.type.toUpperCase()}` : `THREAT: ${assignedEmergency.type.toUpperCase()}`}
                    </div>
                    <div className="text-xxs opacity-85">
                      {lang === 'es' ? 'Coordenadas:' : 'Coordinates:'} {assignedEmergency.lat.toFixed(5)}°N, {assignedEmergency.lon.toFixed(5)}°W
                    </div>
                  </div>
                </div>

                {/* Real-time traffic gridlock / automated bypass warning indicators */}
                {activeUnit.status === 'dispatched' && (activeUnit.trafficDelay || activeUnit.hasAutoReRoutedForTraffic) && (
                  <div className="flex flex-col gap-2 p-2.5 border border-orange-500/30 bg-orange-500/5 font-mono text-[10px] leading-normal">
                    {activeUnit.trafficDelay && (
                      <div className="flex items-center gap-2 text-orange-400 animate-pulse">
                        <span className="text-xs">⚠️</span>
                        <span className="font-bold uppercase">
                          {lang === 'es' 
                            ? 'TRÁNSITO CRÍTICO DETECTADO: Avance lento por embotellamiento de zona.' 
                            : 'HEAVY GRIDLOCK DETECTED: Unit speed heavily bottlenecked by traffic.'}
                        </span>
                      </div>
                    )}
                    {activeUnit.hasAutoReRoutedForTraffic && (
                      <div className="flex items-center gap-2 text-sky-400">
                        <span className="text-xs">🔄</span>
                        <span className="font-bold uppercase">
                          {lang === 'es'
                            ? 'AUTO-DESVÍO GPS ACTIVO: Ruta re-calculada por satélite para evasión de tráfico.'
                            : 'SATELLITE CO-PILOT: On-the-fly detour active to bypass congestion.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-xs text-[#00FF41] bg-black p-3 border border-[#00FF41]/20 leading-relaxed font-mono">
                  {assignedEmergency.description}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xxs">
                  <div className="bg-black p-2.5 border border-[#00FF41]/20">
                    <span className="text-[#00FF41]/60 block uppercase">{lang === 'es' ? 'PRECISIÓN GPS:' : 'GPS ACCURACY:'}</span>
                    <span className="text-white font-bold">{assignedEmergency.accuracy} {lang === 'es' ? 'metros' : 'meters'}</span>
                  </div>
                  <div className="bg-black p-2.5 border border-[#00FF41]/20">
                    <span className="text-[#00FF41]/60 block uppercase">{lang === 'es' ? 'HORA REPORTE:' : 'REPORT TIME:'}</span>
                    <span className="text-white font-bold">
                      {new Date(assignedEmergency.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center gap-2">
                <CheckCircle className="w-10 h-10 text-[#00FF41]/20" />
                <div>
                  <div className="text-xs text-[#00FF41] font-bold uppercase">
                    {lang === 'es' ? 'SITUACIÓN NORMAL' : 'SITUATION NORMAL'}
                  </div>
                  <div className="text-xxs text-[#00FF41]/50 max-w-xs mt-1">
                    {lang === 'es'
                      ? 'No hay alarmas activas asignadas a esta unidad. Manténgase en posición y espere vectorización autónoma del comando central.'
                      : 'No active alarms assigned to this unit. Maintain position and await autonomous vectoring from central command.'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TELEMETRY READOUT */}
          <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-4 grid grid-cols-3 gap-3">
            <div className="bg-black p-3 border border-[#00FF41]/20 flex flex-col justify-between">
              <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase">
                {lang === 'es' ? 'VELOCIDAD' : 'SPEED'}
              </span>
              <span className="text-xl font-black text-[#00FF41] mt-1">
                {activeUnit.speed.toFixed(1)} <span className="text-xxs">km/h</span>
              </span>
            </div>

            <div className="bg-black p-3 border border-[#00FF41]/20 flex flex-col justify-between">
              <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase">
                {lang === 'es' ? 'RUMBO GPS' : 'GPS BEARING'}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <Compass className="w-5 h-5 text-[#00FF41]" />
                <span className="text-xl font-black text-white">
                  {activeUnit.bearing}°
                </span>
              </div>
            </div>

            <div className="bg-black p-3 border border-[#00FF41]/20 flex flex-col justify-between">
              <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase">
                {lang === 'es' ? 'RESERVA COMB' : 'FUEL FUEL'}
              </span>
              <div className="mt-1">
                <div className="flex justify-between text-xxs mb-1">
                  <span className={activeUnit.batteryOrFuel > 25 ? 'text-[#00FF41]' : 'text-[#FF4444] animate-pulse'}>
                    {activeUnit.batteryOrFuel.toFixed(0)}%
                  </span>
                  <Battery className="w-4 h-4 text-[#00FF41]/60" />
                </div>
                <div className="w-full bg-[#050505] h-1.5 overflow-hidden border border-[#00FF41]/10">
                  <div
                    className={`h-full ${activeUnit.batteryOrFuel > 25 ? 'bg-[#00FF41]' : 'bg-[#FF4444] animate-pulse'}`}
                    style={{ width: `${activeUnit.batteryOrFuel}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MULTI-ROUTE CRITICAL EVALUATOR MODULE */}
          <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-4 flex flex-col gap-3">
            <div className="text-xxs text-[#00FF41]/60 font-bold border-b border-[#00FF41]/20 pb-2 flex justify-between items-center">
              <span className="flex items-center gap-1.5 uppercase font-black text-[#00FF41]">
                <Sparkles className="w-4 h-4 text-[#00FF41] animate-pulse" />
                {lang === 'es' ? 'OPTIMIZADOR MULTI-RUTA EN TIEMPO REAL (S.O.A.E.)' : 'REAL-TIME MULTI-ROUTE OPTIMIZER (S.O.A.E.)'}
              </span>
              <span className="text-xxs bg-[#00FF41]/10 text-[#00FF41] px-1.5 py-0.5 border border-[#00FF41]/30">
                {lang === 'es' ? 'N = 4 CANDIDATAS' : 'N = 4 CANDIDATES'}
              </span>
            </div>

            {assignedEmergency ? (
              <div className="flex flex-col gap-3">
                
                {/* Evaluating / Scanning Overlay */}
                {isEvaluating ? (
                  <div className="bg-[#050505] border border-[#00FF41]/40 p-4 text-center flex flex-col items-center justify-center min-h-[160px] gap-3">
                    <span className="text-xs font-black tracking-widest text-[#00FF41] animate-pulse uppercase">
                      {lang === 'es' ? '🔍 ESCANEANDO RED DE VÍAS SECUNDARIAS' : '🔍 SCANNING SECONDARY ROAD NETWORK'}
                    </span>
                    
                    <div className="w-full bg-[#050505] h-3 border border-[#00FF41]/30 relative overflow-hidden max-w-md">
                      <div 
                        className="bg-[#00FF41] h-full transition-all duration-150 shadow-[0_0_8px_#00FF41]"
                        style={{ width: `${evaluationProgress}%` }}
                      ></div>
                    </div>

                    <div className="text-[10px] text-white font-mono h-4 overflow-hidden text-center max-w-lg">
                      {currentEvaluationStep}
                    </div>

                    <div className="text-[9px] text-[#00FF41]/50 uppercase font-bold animate-pulse">
                      {lang === 'es' ? 'Calculando ETAs estocásticos en base a obstrucciones...' : 'Calculating stochastic ETAs based on road obstructions...'}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Active Routes list */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] text-[#00FF41]/60 uppercase mb-1">
                        {lang === 'es' ? 'Seleccione o alterne el vector de trayectoria:' : 'Select or toggle the trajectory vector:'}
                      </p>
                      
                      <div className="grid grid-cols-1 gap-2.5">
                        {routesData.map((route) => {
                          const isSelected = selectedRouteId === route.id;
                          const isBlocked = route.condition === 'blocked';
                          const isOptimal = route.id === 'beta'; // Beta is the optimal one
                          
                          let cardBg = 'bg-[#050505] border-[#00FF41]/20 hover:border-[#00FF41]/50';
                          if (isSelected) {
                            cardBg = 'bg-[#00FF41]/10 border-[#00FF41] shadow-[0_0_6px_#00FF41]/20';
                          } else if (isBlocked) {
                            cardBg = 'bg-stone-950 border-red-900/30 opacity-55 cursor-not-allowed';
                          }

                          let conditionColor = 'text-green-400';
                          let ConditionIcon = Check;
                          if (route.condition === 'traffic') {
                            conditionColor = 'text-yellow-400';
                            ConditionIcon = Clock;
                          } else if (route.condition === 'construction') {
                            conditionColor = 'text-orange-500';
                            ConditionIcon = AlertCircle;
                          } else if (route.condition === 'blocked') {
                            conditionColor = 'text-red-500';
                            ConditionIcon = XCircle;
                          }

                          return (
                            <div
                              key={route.id}
                              onClick={() => {
                                if (isBlocked) return;
                                setSelectedRouteId(route.id);
                                // Update vehicle routePoints instantly
                                if (activeUnit) {
                                  onUpdateTelemetry(activeUnit.id, {
                                    routePoints: route.points,
                                    currentRouteIndex: 0
                                  });
                                }
                              }}
                              className={`p-3 border font-mono transition-all duration-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-2 relative ${
                                !isBlocked ? 'cursor-pointer' : ''
                              } ${cardBg}`}
                            >
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-[#00FF41]'}`}>
                                    {route.name}
                                  </span>
                                  {isOptimal && (
                                    <span className="bg-[#00FF41]/20 text-[#00FF41] text-[8px] font-black px-1 border border-[#00FF41]/40 uppercase tracking-wider">
                                      {lang === 'es' ? '★ Óptimo' : '★ Optimal'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2.5 text-[10px] text-[#00FF41]/60">
                                  <span>{lang === 'es' ? 'Distancia:' : 'Distance:'} <b className="text-white">{route.distance.toFixed(1)} km</b></span>
                                  <span>•</span>
                                  <span>{lang === 'es' ? 'Velocidad prom:' : 'Avg speed:'} <b className="text-white">{route.speed} km/h</b></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-[#00FF41]/10 pt-1.5 md:pt-0">
                                {/* Condition info */}
                                <div className="flex items-center gap-1">
                                  <ConditionIcon className={`w-3.5 h-3.5 ${conditionColor}`} />
                                  <span className={`text-[10px] font-bold ${conditionColor} uppercase`}>
                                    {route.conditionLabel}
                                  </span>
                                </div>

                                {/* ETA travel time */}
                                <div className="text-right">
                                  <span className="text-[10px] text-[#00FF41]/50 block uppercase text-[9px]">ETA EST.</span>
                                  <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-[#00FF41]'}`}>
                                    {route.totalTime === Infinity 
                                      ? 'N/D' 
                                      : `${Math.floor(route.totalTime / 60)}m ${route.totalTime % 60}s`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* AI Logic explanation block */}
                    <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-3 flex gap-2.5 items-start mt-1">
                      <Sparkles className="w-5 h-5 text-[#00FF41] shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <div className="text-[10px] font-black text-white uppercase tracking-wider">
                          {lang === 'es' ? 'JUSTIFICACIÓN SISTÉMICA DE ENRUTAMIENTO:' : 'SYSTEMIC ROUTING JUSTIFICATION:'}
                        </div>
                        <p className="text-[10px] text-[#00FF41]/80 mt-1 leading-relaxed">
                          {lang === 'es'
                            ? `El optimizador determinó que la ${optimalRouteName} minimiza el tiempo de llegada total. `
                            : `The optimizer determined that ${optimalRouteName} minimizes the total arrival time. `}
                          {responseSavingsStr}
                        </p>
                      </div>
                    </div>

                    {/* Manual scan rerun button */}
                    <button
                      onClick={handleTriggerReevaluation}
                      className="w-full py-2 bg-[#050505] hover:bg-[#00FF41]/10 border border-[#00FF41]/30 text-xxs font-black text-white uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-[#00FF41]" />
                      {lang === 'es' ? 'RE-EVALUAR RED DE RUTAS (S.O.A.E.)' : 'RE-EVALUATE ROUTE NETWORK (S.O.A.E.)'}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-xxs text-[#00FF41]/40 uppercase font-mono">
                {lang === 'es' 
                  ? 'Establezca una unidad en estado "Despachada" para evaluar trayectorias viales en tiempo real.'
                  : 'Dispatch a unit to evaluate road trajectories in real time.'}
              </div>
            )}
          </div>

          {/* GIANT ROUTE BLOCKED ACTION BUTTON */}
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex justify-between items-center px-1">
              <span className="text-xxs text-[#00FF41]/60 uppercase">
                {lang === 'es' ? 'Protocolo de Desvío Manual:' : 'Manual Rerouting Protocol:'}
              </span>
              <button
                onClick={() => setShowRouteBlockedHelp(!showRouteBlockedHelp)}
                className="flex items-center gap-1 text-[10px] text-[#00FF41]/70 hover:text-[#00FF41] cursor-pointer bg-[#050505] px-2 py-0.5 border border-[#00FF41]/20 rounded"
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#00FF41]" />
                {lang === 'es' ? 'Explicación' : 'Explain'}
              </button>
            </div>

            {showRouteBlockedHelp && (
              <div className="bg-[#FF4444]/5 border border-[#FF4444]/40 p-2.5 text-[10px] text-[#00FF41]/90 font-mono leading-relaxed relative mb-1">
                <button
                  onClick={() => setShowRouteBlockedHelp(false)}
                  className="absolute top-1 right-2 text-white hover:text-[#FF4444] font-bold text-xxs cursor-pointer"
                >
                  [x]
                </button>
                <p className="font-bold border-b border-[#FF4444]/20 pb-1 mb-1.5 uppercase text-[#FF4444]">
                  {lang === 'es' ? 'ℹ️ Reporte de Obstrucción de Ruta' : 'ℹ️ Route Blockage Reporting'}
                </p>
                <p>
                  {lang === 'es'
                    ? 'Si el camión encuentra tráfico detenido, obras viales, inundaciones o manifestaciones que impidan el paso físico, presionar este botón notifica inmediatamente a la central satelital SOAE para re-calcular y forzar una ruta alternativa.'
                    : 'If the truck encounters gridlock, road work, flooding, or protest blockades that halt physical passage, clicking this button immediately signals the SOAE satellite center to calculate and force an alternative route.'}
                </p>
              </div>
            )}

            <button
              onClick={() => onTriggerRouteBlocked(activeUnit.id)}
              disabled={activeUnit.status !== 'dispatched'}
              className={`w-full py-4 px-6 font-black text-sm uppercase transition-all flex items-center justify-center gap-3 tracking-wider border-2 ${
                activeUnit.status === 'dispatched'
                  ? 'bg-[#FF4444] text-black border-[#FF4444] hover:bg-transparent hover:text-[#FF4444] cursor-pointer'
                  : 'bg-[#0a0a0a] text-stone-600 border-[#00FF41]/10 cursor-not-allowed'
              }`}
            >
              <AlertTriangle className={`w-5 h-5 ${activeUnit.status === 'dispatched' ? 'animate-bounce' : ''}`} />
              {lang === 'es' ? '[ RUTA BLOQUEADA ] - FORZAR RE-VECTORES' : '[ ROUTE BLOCKED ] - FORCE RE-VECTOR'}
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: NAVIGATION INSTRUMENT & TRAINING SLIDERS (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Tactical Vector Navigation Display */}
          <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-4 flex flex-col items-center justify-center relative min-h-[220px]">
            <div className="absolute top-3 left-3 text-[10px] text-[#00FF41]/60 font-bold">
              {lang === 'es' ? 'ORIENTACIÓN TÁCTICA HUD' : 'TACTICAL HUD ORIENTATION'}
            </div>
            
            <div className="relative w-40 h-40 flex items-center justify-center rounded-full border border-[#00FF41]/30 bg-[#050505]">
              {/* Radar rings */}
              <div className="absolute w-32 h-32 rounded-full border border-[#00FF41]/10"></div>
              <div className="absolute w-24 h-24 rounded-full border border-[#00FF41]/5"></div>
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[#00FF41]/20"></div>
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#00FF41]/20"></div>

              {/* Bearing pointer */}
              <div
                className="absolute w-full h-full transition-transform duration-500"
                style={{ transform: `rotate(${activeUnit.bearing}deg)` }}
              >
                <Navigation className="w-8 h-8 text-[#00FF41] absolute top-2 left-1/2 -translate-x-1/2 fill-[#00FF41]/20" />
              </div>

              {/* Central Telemetric Core */}
              <div className="z-10 bg-black border border-[#00FF41]/30 rounded-full p-2 text-center">
                <span className="text-[9px] text-[#00FF41]/60 block font-bold">GPS HEADING</span>
                <span className="text-xs font-black text-[#00FF41]">{activeUnit.bearing}°</span>
              </div>
            </div>

            <div className="mt-4 text-center text-xxs text-[#00FF41]/80 w-full px-4 border-t border-[#00FF41]/10 pt-3">
              {activeUnit.status === 'dispatched' && totalRoutePoints > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center text-[10px]">
                    <span>
                      {lang === 'es' ? 'Punto de Ruta:' : 'Waypoint:'}{' '}
                      <span className="text-white font-bold">{currentIdx + 1}</span>{' '}
                      {lang === 'es' ? 'de' : 'of'}{' '}
                      <span className="text-white font-bold">{totalRoutePoints}</span>
                    </span>
                    <span className="text-white font-bold">{routeProgressPercent.toFixed(0)}%</span>
                  </div>

                  {/* Sleek route progress bar */}
                  <div className="w-full bg-[#050505] h-2.5 border border-[#00FF41]/30 relative overflow-hidden">
                    <div 
                      className="bg-[#00FF41] h-full transition-all duration-300 shadow-[0_0_8px_#00FF41]"
                      style={{ width: `${routeProgressPercent}%` }}
                    ></div>
                  </div>

                  {/* ETA & Status Block */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div className="bg-black/50 border border-[#00FF41]/20 p-1.5 text-center">
                      <span className="text-[9px] text-[#00FF41]/50 block uppercase">
                        {lang === 'es' ? 'ETA ESTIMADO' : 'ESTIMATED ETA'}
                      </span>
                      <span className="text-xs font-black text-white animate-pulse">{etaFormatted}</span>
                    </div>
                    <div className="bg-black/50 border border-[#00FF41]/20 p-1.5 text-center">
                      <span className="text-[9px] text-[#00FF41]/50 block uppercase">
                        {lang === 'es' ? 'TPO DE VIAJE' : 'TRAVEL TIME'}
                      </span>
                      <span className="text-xs font-black text-[#00FF41]">{remainingWaypoints * 12}s</span>
                    </div>
                  </div>

                  {/* Simulated Auto-Route Button */}
                  <button
                    onClick={handleToggleAutoRoute}
                    className={`mt-2 w-full py-2.5 px-4 text-xs font-black uppercase transition-all flex items-center justify-center gap-2 border tracking-wider cursor-pointer ${
                      autoRoutingUnitId === activeUnit.id
                        ? 'bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444] hover:bg-[#FF4444]/20'
                        : 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41] hover:bg-[#00FF41]/20'
                    }`}
                  >
                    <Play className={`w-3.5 h-3.5 ${autoRoutingUnitId === activeUnit.id ? 'animate-pulse' : ''}`} />
                    {autoRoutingUnitId === activeUnit.id
                      ? (lang === 'es' ? 'PAUSAR AUTO-RUTA' : 'PAUSE AUTO-ROUTE')
                      : (lang === 'es' ? 'INICIAR AUTO-RUTA' : 'START AUTO-ROUTE')}
                  </button>
                </div>
              ) : (
                <div className="text-xxs text-[#00FF41]/50 uppercase py-2">
                  {lang === 'es' ? 'Ruta en espera de despacho' : 'Route awaiting dispatch'}
                </div>
              )}
            </div>
          </div>

          {/* LIVE TRAFFIC CORRIDOR MONITOR (S.O.A.E.) */}
          <div className="bg-[#0a0a0a] border border-orange-500/30 p-4 flex flex-col gap-3 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-xl pointer-events-none"></div>
            <div className="text-xxs text-orange-400 font-black border-b border-orange-500/20 pb-2 flex items-center justify-between uppercase">
              <span className="flex items-center gap-1.5">
                <span className="text-xs">🚦</span>
                <span>
                  {lang === 'es' ? 'Radar de Tránsito y Velocidades' : 'Live Traffic & Corridor Radar'}
                </span>
              </span>
              <span className="text-[9px] text-orange-400/70 px-1.5 py-0.5 border border-orange-500/20 bg-orange-500/10 font-mono">
                {lang === 'es' ? 'TIEMPO REAL' : 'LIVE'}
              </span>
            </div>

            {/* General metrics */}
            <div className="grid grid-cols-3 gap-2 font-mono text-[9px] leading-tight">
              <div className="bg-black/40 border border-[#00FF41]/10 p-2">
                <span className="text-stone-500 block uppercase mb-1">{lang === 'es' ? 'Velocidad' : 'Current Speed'}</span>
                <span className={`text-xs font-black ${activeUnit.speed && activeUnit.speed < 15 ? 'text-red-400 animate-pulse' : 'text-[#00FF41]'}`}>
                  {activeUnit.speed ? `${activeUnit.speed.toFixed(1)} km/h` : '0.0 km/h'}
                </span>
              </div>
              <div className="bg-black/40 border border-[#00FF41]/10 p-2">
                <span className="text-stone-500 block uppercase mb-1">{lang === 'es' ? 'Nivel Tránsito' : 'Congestion Level'}</span>
                <span className={`text-xs font-black ${activeUnit.trafficDelay ? 'text-orange-400 animate-pulse' : 'text-[#00FF41]'}`}>
                  {activeUnit.trafficDelay 
                    ? (lang === 'es' ? 'CRÍTICO' : 'GRIDLOCK') 
                    : (lang === 'es' ? 'FLUIDO' : 'CLEAR')}
                </span>
              </div>
              <div className="bg-black/40 border border-[#00FF41]/10 p-2">
                <span className="text-stone-500 block uppercase mb-1">{lang === 'es' ? 'Auto-Desvío' : 'Bypass Detour'}</span>
                <span className={`text-xs font-black ${activeUnit.hasAutoReRoutedForTraffic ? 'text-sky-400' : 'text-stone-500'}`}>
                  {activeUnit.hasAutoReRoutedForTraffic 
                    ? (lang === 'es' ? 'COMPLETO' : 'ACTIVE') 
                    : (lang === 'es' ? 'STANDBY' : 'STANDBY')}
                </span>
              </div>
            </div>

            {/* List of active unresolved congestion bottlenecks (active incidents) */}
            <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
              <div className="text-[9px] text-[#00FF41]/50 uppercase font-bold tracking-wide">
                {lang === 'es' ? 'Obstáculos / Focos de Embotellamiento Activos:' : 'Active Obstructions & Gridlock Sources:'}
              </div>
              {reports.filter(r => r.status !== 'resolved').length > 0 ? (
                reports.filter(r => r.status !== 'resolved').map((rep) => {
                  // Calculate distance from active unit to this incident
                  const dist = getHaversineDistance(activeUnit.lat, activeUnit.lon, rep.lat, rep.lon);
                  const isAffecting = dist < 0.25; // 250 meters congestion zone
                  
                  return (
                    <div 
                      key={rep.id} 
                      className={`p-1.5 border font-mono text-[9px] flex justify-between items-center transition-colors ${
                        isAffecting 
                          ? 'bg-orange-500/10 border-orange-500/40 text-orange-400 font-bold' 
                          : 'bg-black/30 border-stone-800/20 text-stone-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-xs">{rep.type === 'fire' ? '🔥' : '🚨'}</span>
                        <span className="truncate">
                          {rep.description ? rep.description.substring(0, 25) : rep.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isAffecting && (
                          <span className="text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 py-0.2 animate-pulse uppercase">
                            {lang === 'es' ? 'CONGESTIONADO (4 km/h)' : 'GRIDLOCK (4 km/h)'}
                          </span>
                        )}
                        <span className="font-bold text-white">
                          {dist.toFixed(2)} km
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-2 text-stone-600 font-mono text-[9px] border border-dashed border-[#00FF41]/10 uppercase">
                  {lang === 'es' ? 'No hay obstrucciones activas en el mapa viales' : 'No active road obstructions detected'}
                </div>
              )}
            </div>
          </div>

          {/* Real-World Street Turn-by-Turn Guidance Log */}
          <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-4 flex flex-col gap-3">
            <div className="text-xxs text-[#00FF41] font-black border-b border-[#00FF41]/20 pb-2 flex items-center justify-between uppercase">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-[#00FF41] animate-spin" style={{ animationDuration: '6s' }} />
                <span>
                  {lang === 'es' ? 'Navegación Paso a Paso GPS Real' : 'Real GPS Turn-by-Turn Road Guidance'}
                </span>
              </span>
              <span className="text-[9px] text-[#00FF41]/50 px-1 py-0.5 border border-[#00FF41]/20 bg-[#00FF41]/5 font-mono">
                {lang === 'es' ? 'SATELLITE SYNC' : 'SATELLITE SYNC'}
              </span>
            </div>

            {activeUnit.status === 'dispatched' && navSteps.length > 0 ? (
              <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-1">
                {navSteps.map((step, idx) => {
                  const isPassed = idx < activeStepIdx;
                  const isActive = idx === activeStepIdx;
                  
                  let stepIcon = <ArrowUp className="w-3.5 h-3.5 text-[#00FF41]" />;
                  if (step.type === 'left') stepIcon = <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />;
                  if (step.type === 'right') stepIcon = <ArrowRight className="w-3.5 h-3.5 text-orange-400" />;
                  if (step.type === 'start') stepIcon = <Compass className="w-3.5 h-3.5 text-green-400" />;
                  if (step.type === 'arrival') stepIcon = <AlertCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />;

                  return (
                    <div 
                      key={idx}
                      className={`flex flex-col gap-1 p-2 font-mono text-[10px] transition-all border ${
                        isActive 
                          ? 'bg-[#00FF41]/10 border-[#00FF41]/50 text-white shadow-[0_0_10px_rgba(0,255,65,0.05)] font-bold' 
                          : step.isCongested && !isPassed
                            ? 'bg-orange-500/5 border-orange-500/30 text-orange-300'
                            : isPassed
                              ? 'bg-transparent border-transparent text-[#00FF41]/20 line-through decoration-[#00FF41]/10'
                              : 'bg-black/20 border-[#00FF41]/5 text-[#00FF41]/60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`mt-0.5 p-1 rounded-none border ${
                          isActive 
                            ? 'border-[#00FF41]/40 bg-black text-[#00FF41]' 
                            : step.isCongested && !isPassed
                              ? 'border-orange-500/30 bg-black text-orange-400'
                              : 'border-[#00FF41]/10 bg-black/40 text-[#00FF41]/30'
                        }`}>
                          {stepIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start gap-2">
                            <span className={isActive ? 'text-white font-bold' : ''}>
                              {step.instruction}
                            </span>
                            <span className="text-[9px] text-[#00FF41]/40 whitespace-nowrap">
                              {step.distance}
                            </span>
                          </div>
                        </div>
                      </div>

                      {step.isCongested && !isPassed && (
                        <div className="pl-8 text-[8px] uppercase font-bold text-orange-400 flex items-center gap-1.5">
                          <span>🚧</span>
                          <span>
                            {lang === 'es' 
                              ? 'ADVERTENCIA: Zona de congestión viales de 250m detectada adelante' 
                              : 'WARNING: 250m road congestion zone detected ahead'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-stone-600 font-mono text-[10px] border border-dashed border-[#00FF41]/10 uppercase">
                {lang === 'es' ? 'Despache una unidad para iniciar guía satelital de calles' : 'Dispatch a unit to activate satellite turn-by-turn log'}
              </div>
            )}
          </div>

          {/* SANDBOX TRAINEE TELEMETRY SIMULATOR PANEL */}
          {isSimulation && (
            <div className="bg-[#0a0a0a] border border-[#FF4444]/20 p-4 flex flex-col gap-3">
              <div className="text-xxs text-[#FF4444] font-black border-b border-[#FF4444]/20 pb-2 flex items-center gap-1.5 uppercase">
                <Sliders className="w-4 h-4" />
                <span>
                  {lang === 'es' ? 'Simulador Telemetría GPS Táctico' : 'Tactical GPS Telemetry Simulator'}
                </span>
              </div>

              {activeUnit.status === 'dispatched' && totalRoutePoints > 0 ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-xxs text-[#00FF41]/60 mb-1.5">
                      <span>
                        {lang === 'es' ? 'POSICIÓN DE RUTA GPS MANUAL:' : 'MANUAL ROUTE GPS PROGRESSION:'}
                      </span>
                      <span className="text-white font-bold">{routeProgressPercent.toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={routeProgressPercent}
                      onChange={(e) => handleGpsProgressChange(Number(e.target.value))}
                      className="w-full h-2 bg-[#050505] appearance-none cursor-pointer accent-[#FF4444] border border-[#00FF41]/30"
                    />
                  </div>

                  {/* Manual speed and battery override */}
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      onClick={() => {
                        // Progress unit forward by 1 step
                        const nextIdx = Math.min(totalRoutePoints - 1, currentIdx + 1);
                        handleGpsProgressChange((nextIdx / (totalRoutePoints - 1)) * 100);
                      }}
                      className="py-1.5 bg-[#050505] hover:bg-[#00FF41]/10 border border-[#00FF41]/30 text-xxs font-bold text-white uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-[#00FF41]" /> {lang === 'es' ? 'Avance +1' : 'Advance +1'}
                    </button>
                    <button
                      onClick={() => {
                        // Restore fuel
                        onUpdateTelemetry(activeUnit.id, { batteryOrFuel: 100 });
                      }}
                      className="py-1.5 bg-[#050505] hover:bg-[#00FF41]/10 border border-[#00FF41]/30 text-xxs font-bold text-white uppercase flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-blue-400" /> {lang === 'es' ? 'Recargar Comb' : 'Refuel Vehicle'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xxs text-[#00FF41]/40 text-center py-4 uppercase">
                  {lang === 'es'
                    ? 'Despache la unidad primero para habilitar el simulador de ruta GPS interactivo.'
                    : 'Dispatch unit first to enable interactive GPS route simulator.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
