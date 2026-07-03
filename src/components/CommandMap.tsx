/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Maximize2, Minimize2, MousePointer, Building, ShieldAlert, X } from 'lucide-react';
import { EmergencyReport, FleetUnit, CoverageSector } from '../types';

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

function calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

function getUnitPopupHtml(unit: FleetUnit, sectors: CoverageSector[], lang: 'es' | 'en'): string {
  let typeEmoji = '🚒';
  let typeLabelEs = 'Bomba Contra Incendios';
  let typeLabelEn = 'Fire Engine';
  if (unit.type === 'heavy_rescue') {
    typeEmoji = '🛠️';
    typeLabelEs = 'Rescate Pesado';
    typeLabelEn = 'Heavy Rescue';
  } else if (unit.type === 'ambulance') {
    typeEmoji = '🚑';
    typeLabelEs = 'Soporte Vital Avanzado';
    typeLabelEn = 'Advanced Life Support';
  } else if (unit.type === 'hazmat') {
    typeEmoji = '🧪';
    typeLabelEs = 'Contención Química';
    typeLabelEn = 'Hazmat Containment';
  }

  let statusColor = '#00FF41'; // Green
  let statusBg = 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/30';
  let statusTextEs = 'DISPONIBLE // EN RETÉN';
  let statusTextEn = 'AVAILABLE // ON STANDBY';
  if (unit.status === 'dispatched') {
    statusColor = '#38bdf8'; // Sky blue
    statusBg = 'bg-sky-400/10 text-sky-400 border-sky-400/30';
    statusTextEs = 'EN MISIÓN // ACTIVO';
    statusTextEn = 'ON MISSION // EN ROUTE';
  } else if (unit.status === 'offline') {
    statusColor = '#78716c'; // Stone
    statusBg = 'bg-stone-800 text-stone-500 border-stone-800';
    statusTextEs = 'FUERA DE SERVICIO';
    statusTextEn = 'OUT OF SERVICE';
  }

  // Find base sector name
  const baseSec = sectors.find(s => s.id === unit.baseSectorId);
  const baseName = baseSec ? baseSec.name : (lang === 'es' ? 'Desconocida' : 'Unknown');

  // Mission info
  let missionInfoHtml = '';
  if (unit.status === 'dispatched') {
    const isCover = unit.activeMissionId && unit.activeMissionId.startsWith('cover-');
    if (isCover) {
      missionInfoHtml = `
        <div class="mt-2 p-1.5 bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] text-[8px] font-bold uppercase tracking-wider animate-pulse">
          ⚡ ${lang === 'es' ? 'COBERTURA DINÁMICA DE ESTACIÓN VACANTE' : 'DYNAMIC STATION COVERAGE RELOCATION'}
        </div>
      `;
    } else {
      missionInfoHtml = `
        <div class="mt-2 p-1.5 bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] text-[8px] font-bold uppercase tracking-wider animate-pulse">
          🚨 ${lang === 'es' ? 'DESPACHO PRIORITARIO DE AUXILIO' : 'EMERGENCY DISPATCH MISSION'}
        </div>
      `;
    }
  }

  // Fuel color
  let fuelColor = '#00FF41';
  if (unit.batteryOrFuel < 30) fuelColor = '#FF4444';
  else if (unit.batteryOrFuel < 60) fuelColor = '#f97316';

  return `
    <div class="text-xs font-mono p-1.5 leading-normal max-w-[240px]">
      <div class="font-bold border-b border-[#00FF41]/30 pb-1 mb-1.5 text-white uppercase flex items-center gap-1.5">
        <span class="text-sm">${typeEmoji}</span>
        <div class="truncate">
          <span class="text-[#00FF41] block text-xs font-black">${unit.name}</span>
          <span class="text-[8px] text-stone-400 block font-normal normal-case">${lang === 'es' ? typeLabelEs : typeLabelEn}</span>
        </div>
      </div>

      <div class="flex justify-between items-center bg-[#020202] border border-stone-900 p-1 mb-1.5">
        <span class="text-stone-500 text-[8px] uppercase font-bold">${lang === 'es' ? 'ESTADO' : 'STATUS'}:</span>
        <span class="px-1 text-[8px] font-bold uppercase border ${statusBg}">
          ${lang === 'es' ? statusTextEs : statusTextEn}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-1.5 mb-1.5">
        <div class="bg-[#020202] border border-stone-900 p-1">
          <span class="text-stone-500 text-[8px] block uppercase font-bold">${lang === 'es' ? 'Velocidad' : 'Speed'}:</span>
          <span class="text-xs font-bold text-white">${unit.speed.toFixed(0)} km/h</span>
        </div>
        <div class="bg-[#020202] border border-stone-900 p-1">
          <span class="text-stone-500 text-[8px] block uppercase font-bold">${lang === 'es' ? 'Base Asignada' : 'Assigned Base'}:</span>
          <span class="text-[9px] font-bold text-white truncate block" title="${baseName}">${baseName.replace(/\s*\(.*\)/g, '')}</span>
        </div>
      </div>

      <div class="bg-[#020202] border border-stone-900 p-1 mb-1.5">
        <div class="flex justify-between text-[8px] text-stone-500 uppercase font-bold mb-0.5">
          <span>${lang === 'es' ? 'Combustible / Energía' : 'Fuel / Power'}:</span>
          <span style="color: ${fuelColor}">${unit.batteryOrFuel.toFixed(0)}%</span>
        </div>
        <div class="w-full bg-[#111111] h-1 border border-stone-800 relative overflow-hidden">
          <div class="h-full" style="width: ${unit.batteryOrFuel}%; background-color: ${fuelColor}"></div>
        </div>
      </div>

      <div class="text-[8px] text-stone-500 border-t border-stone-900 pt-1 flex justify-between font-mono">
        <span>COORDS:</span>
        <span class="text-stone-400">${unit.lat.toFixed(5)}, ${unit.lon.toFixed(5)}</span>
      </div>

      ${missionInfoHtml}
    </div>
  `;
}

interface CommandMapProps {
  sectors: CoverageSector[];
  units: FleetUnit[];
  reports: EmergencyReport[];
  selectedUnitId?: string;
  selectedReportId?: string;
  onSelectUnit?: (id: string) => void;
  onSelectReport?: (id: string) => void;
  isSimulation?: boolean;
  lang?: 'es' | 'en';
  blockages?: { id: string; lat: number; lon: number; timestamp: number }[];
  focusedLocation?: { lat: number; lon: number; timestamp: number } | null;
  onAddBaseStation?: (payload: any) => void;
  onAddIncident?: (payload: any) => void;
}

export default function CommandMap({
  sectors,
  units,
  reports,
  selectedUnitId,
  selectedReportId,
  onSelectUnit,
  onSelectReport,
  isSimulation = false,
  lang = 'es',
  blockages = [],
  focusedLocation = null,
  onAddBaseStation,
  onAddIncident,
}: CommandMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    sectors: L.FeatureGroup;
    units: L.FeatureGroup;
    reports: L.FeatureGroup;
    routes: L.FeatureGroup;
    traffic: L.FeatureGroup;
  } | null>(null);

  const [showTraffic, setShowTraffic] = useState<boolean>(true);
  const [isMapFullscreen, setIsMapFullscreen] = useState<boolean>(false);
  const [actionMode, setActionMode] = useState<'navigate' | 'place_station' | 'place_incident'>('navigate');
  const [tempClickCoord, setTempClickCoord] = useState<{ lat: number; lon: number } | null>(null);

  const actionModeRef = useRef(actionMode);
  useEffect(() => {
    actionModeRef.current = actionMode;
  }, [actionMode]);

  // Dictionary to store and track persistent Leaflet unit marker states for smooth setLatLng sliding
  const unitMarkersRef = useRef<Record<string, {
    marker: L.Marker;
    currentLat: number;
    currentLon: number;
    targetLat: number;
    targetLon: number;
    routePolyline: L.Polyline | null;
    destCircle: L.CircleMarker | null;
    selectionCircle: L.Circle | null;
    animFrameId?: number;
    trailCoordinates?: [number, number][];
    trailPolyline?: L.Polyline | null;
  }>>({});

  // Sync Leaflet Layers with State
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if not already present
    if (!mapRef.current) {
      const initialCenter: [number, number] = sectors[0]?.center || [19.4326, -99.1332];
      
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 12.5,
        minZoom: 11,
        maxZoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      // Add dark-themed CartoDB Voyager map layer to match mission control aesthetic
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
      }).addTo(map);

      // Create separate overlay groups for modular synchronization
      const sectorsGroup = L.featureGroup().addTo(map);
      const unitsGroup = L.featureGroup().addTo(map);
      const reportsGroup = L.featureGroup().addTo(map);
      const routesGroup = L.featureGroup().addTo(map);
      const trafficGroup = L.featureGroup().addTo(map);

      layersRef.current = {
        sectors: sectorsGroup,
        units: unitsGroup,
        reports: reportsGroup,
        routes: routesGroup,
        traffic: trafficGroup,
      };

      mapRef.current = map;

      // Click listener for placing base stations or incident vectors
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (actionModeRef.current === 'navigate') return;
        const { lat, lng } = e.latlng;
        setTempClickCoord({ lat, lon: lng });
      });

      // Handle Map container resizes cleanly via ResizeObserver
      let resizeAnimationFrameId: number | null = null;
      const resizeObserver = new ResizeObserver(() => {
        if (resizeAnimationFrameId !== null) {
          cancelAnimationFrame(resizeAnimationFrameId);
        }
        resizeAnimationFrameId = requestAnimationFrame(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        });
      });
      resizeObserver.observe(mapContainerRef.current);

      return () => {
        resizeObserver.disconnect();
        if (resizeAnimationFrameId !== null) {
          cancelAnimationFrame(resizeAnimationFrameId);
        }
        map.remove();
        mapRef.current = null;
        layersRef.current = null;
        // Cancel any pending telemetry slide animation frames on component unmount
        Object.values(unitMarkersRef.current).forEach((state: any) => {
          if (state.animFrameId) {
            cancelAnimationFrame(state.animFrameId);
          }
        });
        unitMarkersRef.current = {};
      };
    }
  }, []);

  // Auto-pan / Fly map when base coordinates (sectors) change
  const firstSectorCenter = sectors[0]?.center;
  useEffect(() => {
    const map = mapRef.current;
    if (map && firstSectorCenter) {
      map.flyTo(firstSectorCenter, 12.5, {
        animate: true,
        duration: 1.5
      });
    }
  }, [firstSectorCenter]);

  // Zoom/Fly map when focusedLocation is updated (e.g. from a double-click on list)
  useEffect(() => {
    const map = mapRef.current;
    if (map && focusedLocation) {
      map.flyTo([focusedLocation.lat, focusedLocation.lon], 14.5, {
        animate: true,
        duration: 1.5
      });
    }
  }, [focusedLocation]);

  // Update Layers dynamically on data props changes
  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    // 1. Clear existing layers
    layers.sectors.clearLayers();
    // Note: layers.units is NOT cleared here to persist active markers for smooth coordinate animations.
    layers.reports.clearLayers();
    layers.routes.clearLayers();
    if (layers.traffic) {
      layers.traffic.clearLayers();
    }

    // 1.3 Render Temporary Click Placement Marker if active
    if (tempClickCoord) {
      const tempIcon = L.divIcon({
        className: 'custom-temp-placement-marker',
        html: `
          <div class="relative flex items-center justify-center" style="width: 36px; height: 36px;">
            <div class="absolute w-8 h-8 rounded-full border border-yellow-500 animate-ping opacity-60"></div>
            <div class="absolute w-6 h-6 rounded-full border border-yellow-500 flex items-center justify-center bg-black/80 text-xs shadow-lg">
              🎯
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      L.marker([tempClickCoord.lat, tempClickCoord.lon], { icon: tempIcon }).addTo(layers.routes);
    }

    // 1.2 Traffic layer is now rendered directly over active routing paths to match real-world street topology perfectly.

    // 1.5 Render Active Route Blockages (Hazard warnings)
    if (blockages && blockages.length > 0) {
      blockages.forEach((blk) => {
        const hazardIcon = L.divIcon({
          className: 'custom-hazard-marker',
          html: `
            <div class="relative flex items-center justify-center animate-bounce" style="width: 28px; height: 28px;">
              <span style="font-size: 18px; filter: drop-shadow(0 0 4px rgba(255,68,68,0.6));">🚧</span>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        L.marker([blk.lat, blk.lon], { icon: hazardIcon }).addTo(layers.routes);

        // Pulsing hazard radar circle (using className from our stylesheet)
        L.circle([blk.lat, blk.lon], {
          radius: 130,
          color: '#FF4444',
          fillColor: '#FF4444',
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: '3, 4',
          className: 'hazard-pulse-ring'
        }).addTo(layers.routes);
      });
    }

    // 2. Render Coverage Sectors as dynamic IVR Heatmap polygons
    sectors.forEach((sec) => {
      // Color coding based on IVR level
      let color = '#00FF41'; // safe green
      if (sec.ivr > 0.85) color = '#FF4444'; // critical red
      else if (sec.ivr > 0.65) color = '#f97316'; // orange warning
      else if (sec.ivr > 0.4) color = '#FFD700'; // yellow caution

      const poly = L.polygon(sec.polygon, {
        color: color,
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.15,
        dashArray: sec.ivr > 0.85 ? '4, 4' : undefined,
      });

      // Bind tactical info popup
      poly.bindPopup(`
        <div class="text-xs font-mono p-1">
          <div class="font-bold border-b border-[#00FF41]/30 pb-1 mb-1 text-[#00FF41] text-sm uppercase">${sec.name}</div>
          <div>${lang === 'es' ? 'Densidad' : 'Density'}: <span class="text-white font-medium">${sec.populationDensity.toLocaleString()} ${lang === 'es' ? 'hab/km²' : 'people/km²'}</span></div>
          <div>${lang === 'es' ? 'Riesgo Base' : 'Base Risk'}: <span class="text-yellow-500 font-medium">${(sec.baseRisk * 100).toFixed(0)}%</span></div>
          <div class="mt-2 pt-1 border-t border-[#00FF41]/20 flex justify-between items-center">
            <span>${lang === 'es' ? 'IVR Dinámico' : 'Dynamic RVI'}:</span>
            <span class="font-bold text-sm" style="color: ${color}">${(sec.ivr * 100).toFixed(1)}%</span>
          </div>
          ${sec.ivr > 0.85 ? `<div class="text-red-400 font-bold mt-1 animate-pulse uppercase">${lang === 'es' ? '▲ COBERTURA CRÍTICA' : '▲ CRITICAL COVERAGE'}</div>` : ''}
        </div>
      `);

      poly.addTo(layers.sectors);

      // Add Base Station Marker at sector center with customized telemetry icon
      const stationedUnits = units.filter(u => u.baseSectorId === sec.id || u.originalBaseSectorId === sec.id);
      const baseStationIcon = L.divIcon({
        className: 'custom-base-station-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer" style="width: 32px; height: 32px;">
            <!-- Hexagonal background badge representing the station -->
            <div class="absolute w-7 h-7 rounded bg-black/90 border border-[#00FF41]/60 shadow-[0_0_8px_#00FF41]/30 flex items-center justify-center hover:border-white transition-colors duration-150">
              <span class="text-xs" style="text-shadow: 0 0 3px #00FF41;">🏢</span>
            </div>
            <!-- Outer beacon radar pulse -->
            <div class="absolute w-8 h-8 rounded-full border border-[#00FF41]/30 animate-ping opacity-40 pointer-events-none"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const stationMarker = L.marker(sec.center, { icon: baseStationIcon });
      
      const unitsListHtml = stationedUnits.length > 0
        ? stationedUnits.map(u => {
            let badgeColor = 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/30';
            if (u.status === 'dispatched') badgeColor = 'bg-sky-400/10 text-sky-400 border-sky-400/30';
            if (u.status === 'offline') badgeColor = 'bg-stone-800 text-stone-500 border-stone-800';
            
            return `
              <div class="flex justify-between items-center text-[9px] bg-[#020202] border border-stone-900 p-1 mb-1 font-mono">
                <span class="text-white font-bold">${u.name.toUpperCase()}</span>
                <span class="px-1 text-[8px] border font-bold uppercase rounded ${badgeColor}">${u.status}</span>
              </div>
            `;
          }).join('')
        : `<div class="text-[9px] text-stone-600 uppercase italic font-mono">${lang === 'es' ? 'Sin unidades en retén' : 'No stationed units'}</div>`;

      stationMarker.bindPopup(`
        <div class="text-xs font-mono p-1.5 leading-normal max-w-[200px]">
          <div class="font-bold border-b border-[#00FF41]/40 pb-1 mb-1 text-[#00FF41] text-xs uppercase flex items-center gap-1">
            <span>🏢</span> ${lang === 'es' ? 'BASE OPERATIVA' : 'BASE DEPOT'}: ${sec.name.toUpperCase()}
          </div>
          <div class="text-stone-400 text-[9px] mb-2">
            ${lang === 'es' ? 'Puerto táctico de recarga y despliegue para la flota local.' : 'Tactical charging and deployment port for local response fleet.'}
          </div>
          
          <div class="font-bold text-[9px] text-slate-400 mb-1.5 uppercase tracking-wider border-b border-stone-900 pb-0.5">
            ${lang === 'es' ? 'Vehículos en Retén' : 'Stationed Vehicles'} (${stationedUnits.length}):
          </div>
          ${unitsListHtml}

          <div class="mt-2.5 pt-1.5 border-t border-stone-900 text-stone-500 text-[8px] flex justify-between">
            <span>${lang === 'es' ? 'Vulnerabilidad' : 'Vulnerability'}:</span>
            <span class="font-bold text-white">${(sec.ivr * 100).toFixed(1)}%</span>
          </div>
        </div>
      `, { closeButton: false });

      stationMarker.addTo(layers.sectors);
    });

    // 3. Render Emergency Reports (Pulsing Radar Rings)
    reports.forEach((rep) => {
      if (rep.status === 'resolved') return;

      let color = '#FF4444'; // default red
      let emoji = '🚨';
      if (rep.type === 'fire') { color = '#f97316'; emoji = '🔥'; }
      if (rep.type === 'chemical') { color = '#a855f7'; emoji = '☣️'; }
      if (rep.type === 'landslide') { color = '#b45309'; emoji = '🌋'; }
      if (rep.type === 'medical') { color = '#3b82f6'; emoji = '🚑'; }

      // Custom DivIcon for glowing radar ping
      const pulsingIcon = L.divIcon({
        className: 'custom-radar-ping',
        html: `
          <div class="relative flex items-center justify-center" style="width: 32px; height: 32px;">
            <div class="absolute inset-0 rounded-full animate-ping opacity-60" style="background-color: ${color}; transform: scale(1.6); animation-duration: 2s;"></div>
            <div class="absolute inset-1 rounded-full border border-white opacity-40"></div>
            <div class="z-10 text-base flex items-center justify-center">${emoji}</div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([rep.lat, rep.lon], { icon: pulsingIcon });

      marker.on('click', () => {
        if (onSelectReport) onSelectReport(rep.id);
      });

      // Highlight active selection
      if (selectedReportId === rep.id) {
        L.circle([rep.lat, rep.lon], {
          radius: 120,
          color: '#00FF41',
          weight: 1.5,
          fillColor: 'transparent',
        }).addTo(layers.reports);
      }

      // Add a dynamic 250m Traffic Congestion Gridlock corridor if traffic layer is enabled
      if (showTraffic) {
        L.circle([rep.lat, rep.lon], {
          radius: 250,
          color: '#f97316',
          weight: 1.2,
          dashArray: '3, 4',
          fillColor: '#f97316',
          fillOpacity: 0.03,
          className: 'hazard-pulse-ring'
        }).bindTooltip(`
          <div class="font-mono text-[10px] text-orange-400 font-bold p-1 bg-black/90 border border-orange-500/20 rounded-none">
            ⚠️ ${lang === 'es' ? 'CONGESTIÓN DE TRÁNSITO CRÍTICO (250m)' : 'CRITICAL TRAFFIC CONGESTION (250m)'}<br/>
            <span class="text-white">${lang === 'es' ? 'Velocidad de paso: ~4-8 km/h' : 'Expected Speed: ~4-8 km/h'}</span>
          </div>
        `, { sticky: true, permanent: false }).addTo(layers.reports);
      }

      // Add a small safety accuracy circle
      L.circle([rep.lat, rep.lon], {
        radius: rep.accuracy,
        color: color,
        weight: 1,
        fillColor: color,
        fillOpacity: 0.1,
      }).addTo(layers.reports);

      marker.addTo(layers.reports);
    });

    // 4. Render Fleet Units (Animate persistent markers smoothly)
    const activeUnitIds = new Set(units.filter((u) => u.status !== 'offline').map((u) => u.id));

    // Clear and remove marker states for units that are offline or removed
    Object.keys(unitMarkersRef.current).forEach((id) => {
      if (!activeUnitIds.has(id)) {
        const state = unitMarkersRef.current[id];
        if (state.animFrameId) {
          cancelAnimationFrame(state.animFrameId);
        }
        if (state.marker) state.marker.remove();
        if (state.selectionCircle) state.selectionCircle.remove();
        if (state.routePolyline) state.routePolyline.remove();
        if (state.destCircle) state.destCircle.remove();
        if (state.trailPolyline) state.trailPolyline.remove();
        delete unitMarkersRef.current[id];
      }
    });

    // Draw, update and slide active unit markers
    units.forEach((unit) => {
      if (unit.status === 'offline') return;

      let color = '#3b82f6'; // default blue
      let iconSvg = `<span style="font-size: 12px; line-height: 1;">🚑</span>`;
      if (unit.type === 'fire_truck') { 
        color = '#FF4444'; 
        iconSvg = `<span style="font-size: 12px; line-height: 1;">🚒</span>`;
      }
      if (unit.type === 'heavy_rescue') { 
        color = '#FFD700'; 
        iconSvg = `<span style="font-size: 12px; line-height: 1;">🚛</span>`;
      }
      if (unit.type === 'hazmat') { 
        color = '#a855f7'; 
        iconSvg = `<span style="font-size: 11px; line-height: 1;">☣️</span>`;
      }
      if (unit.type === 'ambulance') { 
        color = '#00FF41'; 
        iconSvg = `<span style="font-size: 12px; line-height: 1;">🚑</span>`;
      }
 
       // Custom DivIcon representing militarized telemetric dot with heading pointer
       const unitIcon = L.divIcon({
         className: 'custom-unit-marker',
         html: `
           <div class="relative flex items-center justify-center" style="width: 38px; height: 38px;">
             <!-- Outer Direction Pointer -->
             <div class="absolute direction-pointer-${unit.id}" style="transform: rotate(${unit.bearing}deg); width: 34px; height: 34px; transition: transform 0.08s linear;">
               <div class="absolute top-0 left-1/2 -translate-x-1/2" style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 7px solid ${color};"></div>
             </div>
             <!-- Central Unit Circle -->
             <div class="z-10 rounded-full flex items-center justify-center font-bold text-xxs shadow-md text-black border border-[#00FF41]/40" 
                  style="background-color: ${color}; width: 22px; height: 22px; font-size: 10px;">
               ${iconSvg}
             </div>
             <!-- Dispatched Pulse Glow -->
             ${unit.status === 'dispatched' ? `<div class="absolute inset-0 rounded-full animate-pulse border border-[#00FF41] opacity-60"></div>` : ''}
           </div>
         `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      let state = unitMarkersRef.current[unit.id];

      if (!state) {
        // Instantiate first-time persistent marker on map
        const marker = L.marker([unit.lat, unit.lon], { icon: unitIcon });
        marker.bindPopup(getUnitPopupHtml(unit, sectors, lang));
        marker.on('click', () => {
          if (onSelectUnit) onSelectUnit(unit.id);
        });
        marker.addTo(layers.units);

        state = {
          marker,
          currentLat: unit.lat,
          currentLon: unit.lon,
          targetLat: unit.lat,
          targetLon: unit.lon,
          routePolyline: null,
          destCircle: null,
          selectionCircle: null,
        };
        unitMarkersRef.current[unit.id] = state;
      } else {
        // Update marker icon configuration dynamically
        state.marker.setIcon(unitIcon);
        state.marker.setPopupContent(getUnitPopupHtml(unit, sectors, lang));
      }

      // 4b. Draw / Update Tactical Selection Circle around current animated location
      const isSelected = selectedUnitId === unit.id;
      if (isSelected) {
        if (!state.selectionCircle) {
          state.selectionCircle = L.circle([state.currentLat, state.currentLon], {
            radius: 180,
            color: '#00FF41',
            weight: 1.5,
            fillColor: 'transparent',
            dashArray: '3, 3',
          }).addTo(layers.units);
        } else {
          state.selectionCircle.setLatLng([state.currentLat, state.currentLon]);
        }
      } else {
        if (state.selectionCircle) {
          state.selectionCircle.remove();
          state.selectionCircle = null;
        }
      }

      // 4c. Draw / Update Active Mission Routing Polyline & Destination ping
      const hasRoute = unit.status === 'dispatched' && unit.routePoints && unit.routePoints.length > 0;
      if (hasRoute) {
        const remainingRoute = unit.routePoints!.slice(unit.currentRouteIndex ?? 0);
        if (remainingRoute.length > 0) {
          const fullPath: [number, number][] = [[state.currentLat, state.currentLon], ...remainingRoute];

          // Upgrade routePolyline to FeatureGroup for multi-colored traffic routing segments if showTraffic is active
          if (!state.routePolyline || typeof (state.routePolyline as any).clearLayers !== 'function') {
            if (state.routePolyline) {
              state.routePolyline.remove();
            }
            state.routePolyline = L.featureGroup().addTo(layers.units);
          } else {
            state.routePolyline.clearLayers();
          }

          // Destination pin marker at path end
          const dest = remainingRoute[remainingRoute.length - 1];

          // 1. Draw Bypassed Direct Route Contrast Layer if unit is auto-rerouted
          if (showTraffic && unit.hasAutoReRoutedForTraffic) {
            L.polyline([[state.currentLat, state.currentLon], dest], {
              color: '#ef4444',
              weight: 2,
              opacity: 0.35,
              dashArray: '4, 6',
              lineCap: 'round',
              lineJoin: 'round'
            }).bindTooltip(`
              <div class="font-mono text-[9px] p-1.5 bg-black/95 border border-red-500/20 text-red-400 leading-normal rounded-none">
                <span class="font-bold">⚠️ ${lang === 'es' ? 'RUTA DIRECTA DESCARTADA' : 'BYPASSED DIRECT ROUTE'}</span><br/>
                <span class="text-stone-400 text-[8px]">${lang === 'es' ? 'Cruza zona de embotellamiento crítico.' : 'Intercepts critical gridlock zone.'}</span>
              </div>
            `, { sticky: true, permanent: false }).addTo(state.routePolyline);
          }

          // 2. Draw segmented, color-coded route sections reflecting real-time congestion
          if (showTraffic) {
            for (let i = 0; i < fullPath.length - 1; i++) {
              const p1 = fullPath[i];
              const p2 = fullPath[i + 1];
              const midLat = (p1[0] + p2[0]) / 2;
              const midLon = (p1[1] + p2[1]) / 2;

              let closestIncidentDist = 999;
              for (const rep of reports) {
                if (rep.status === 'resolved') continue;
                const dist = getHaversineDistance(midLat, midLon, rep.lat, rep.lon);
                if (dist < closestIncidentDist) {
                  closestIncidentDist = dist;
                }
              }

              let segmentColor = '#00FF41'; // neon green clear
              let segmentWeight = 3.5;
              let segmentOpacity = 0.95;
              let segmentClass = 'animated-route-path';
              let segmentTooltip = lang === 'es' ? 'Fluido (50 km/h)' : 'Fluid Speed (50 km/h)';

              if (closestIncidentDist < 0.25) { // within 250m
                segmentColor = '#ef4444'; // critical red
                segmentWeight = 4.5;
                segmentClass = 'hazard-pulse-ring';
                segmentTooltip = lang === 'es' ? 'Embotellamiento Crítico (4 km/h)' : 'Critical Gridlock (4 km/h)';
              } else if (closestIncidentDist < 0.55) { // within 550m
                segmentColor = '#f97316'; // orange slow
                segmentWeight = 4.0;
                segmentTooltip = lang === 'es' ? 'Tránsito Lento (15 km/h)' : 'Heavy Traffic (15 km/h)';
              }

              L.polyline([p1, p2], {
                color: segmentColor,
                weight: segmentWeight,
                opacity: segmentOpacity,
                className: segmentClass,
                lineCap: 'round',
                lineJoin: 'round'
              }).bindTooltip(`
                <div class="font-mono text-[9px] p-1 bg-black/95 text-white border border-[#00FF41]/20 rounded-none">
                  ${segmentTooltip}
                </div>
              `, { sticky: true, permanent: false }).addTo(state.routePolyline);
            }
          } else {
            // Standard simple neon green polyline
            L.polyline(fullPath, {
              color: '#00FF41',
              weight: 3.5,
              opacity: 0.95,
              className: 'animated-route-path',
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(state.routePolyline);
          }

          if (!state.destCircle) {
            state.destCircle = L.circleMarker(dest, {
              radius: 4,
              color: '#00FF41',
              fillColor: '#050505',
              fillOpacity: 1,
              weight: 2,
            }).addTo(layers.units);
          } else {
            state.destCircle.setLatLng(dest);
          }
        } else {
          if (state.routePolyline) { state.routePolyline.remove(); state.routePolyline = null; }
          if (state.destCircle) { state.destCircle.remove(); state.destCircle = null; }
        }
      } else {
        if (state.routePolyline) { state.routePolyline.remove(); state.routePolyline = null; }
        if (state.destCircle) { state.destCircle.remove(); state.destCircle = null; }
      }

      // 4d. Manage Tactical Trail for Dispatched Units
      if (unit.status === 'dispatched') {
        if (!state.trailCoordinates) {
          state.trailCoordinates = [[unit.lat, unit.lon]];
        }

        // Detect telemetry destination changes and append the previous target to trail history
        if (state.targetLat !== unit.lat || state.targetLon !== unit.lon) {
          const prevLat = state.targetLat;
          const prevLon = state.targetLon;
          const lastPoint = state.trailCoordinates[state.trailCoordinates.length - 1];
          if (!lastPoint || Math.abs(lastPoint[0] - prevLat) > 0.0001 || Math.abs(lastPoint[1] - prevLon) > 0.0001) {
            state.trailCoordinates.push([prevLat, prevLon]);
            if (state.trailCoordinates.length > 25) {
              state.trailCoordinates.shift();
            }
          }
        }

        // Render or update Leaflet Polyline trail representing past positions
        if (state.trailCoordinates.length > 0) {
          const trailPath: [number, number][] = [...state.trailCoordinates, [state.currentLat, state.currentLon]];
          if (!state.trailPolyline) {
            state.trailPolyline = L.polyline(trailPath, {
              color: color, // Cohesive color matches unit type (Red, Gold, Purple, Green, Blue)
              weight: 2,
              opacity: 0.45,
              dashArray: '4, 4', // clean tactical dashed pattern
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(layers.units);
          } else {
            state.trailPolyline.setLatLngs(trailPath);
            state.trailPolyline.setStyle({ color });
          }
        }
      } else {
        // Clear trail if unit is no longer active on route
        if (state.trailPolyline) {
          state.trailPolyline.remove();
          state.trailPolyline = null;
        }
        state.trailCoordinates = [];
      }

      // 4e. Trigger smooth coordinate transition if telemetry target coordinate changed
      if (state.targetLat !== unit.lat || state.targetLon !== unit.lon) {
        if (state.animFrameId) {
          cancelAnimationFrame(state.animFrameId);
        }

        const startLat = state.currentLat;
        const startLon = state.currentLon;
        const endLat = unit.lat;
        const endLon = unit.lon;

        state.targetLat = endLat;
        state.targetLon = endLon;

        const startTime = performance.now();
        const duration = 1200; // 1.2s smooth sliding translation matching the telemetry refresh interval

        const step = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Easing function: ease-out quadratic for pleasant deceleration
          const ease = progress * (2 - progress);

          const curLat = startLat + (endLat - startLat) * ease;
          const curLon = startLon + (endLon - startLon) * ease;

          // Compute real-time bearing to orient the marker pointer precisely along street angles
          const dLat = curLat - state.currentLat;
          const dLon = curLon - state.currentLon;
          if (Math.abs(dLat) > 0.000005 || Math.abs(dLon) > 0.000005) {
            const liveHeading = calculateHeading(state.currentLat, state.currentLon, curLat, curLon);
            const markerEl = state.marker.getElement();
            if (markerEl) {
              const pointerEl = markerEl.querySelector(`.direction-pointer-${unit.id}`) as HTMLElement;
              if (pointerEl) {
                pointerEl.style.transform = `rotate(${liveHeading}deg)`;
              }
            }
          }

          state.currentLat = curLat;
          state.currentLon = curLon;

          // Slide Leaflet marker in real-time
          state.marker.setLatLng([curLat, curLon]);

          // Keep selection indicator snapped to smooth animated position
          if (state.selectionCircle) {
            state.selectionCircle.setLatLng([curLat, curLon]);
          }

          // Keep routing polyline start coordinate synchronized to smooth animated position
          if (state.routePolyline && unit.status === 'dispatched' && unit.routePoints) {
            const remRoute = unit.routePoints.slice(unit.currentRouteIndex ?? 0);
            const pathPoints: [number, number][] = [[curLat, curLon], ...remRoute];
            if (typeof (state.routePolyline as any).setLatLngs === 'function') {
              state.routePolyline.setLatLngs(pathPoints);
            } else {
              // It's a FeatureGroup (segmented traffic routes). Keep the start of the first segment attached to the truck's live position.
              const layersArray = (state.routePolyline as L.FeatureGroup).getLayers() as L.Polyline[];
              const routeSegments = layersArray.filter(l => l.options.className === 'animated-route-path' || l.options.className === 'hazard-pulse-ring');
              if (routeSegments.length > 0) {
                const firstSeg = routeSegments[0];
                const latlngs = firstSeg.getLatLngs() as L.LatLng[];
                if (latlngs.length >= 2) {
                  firstSeg.setLatLngs([L.latLng(curLat, curLon), latlngs[1]]);
                }
              }
            }
          }

          // Update trail polyline to extend smoothly up to the live sliding coordinates
          if (state.trailPolyline && state.trailCoordinates && state.trailCoordinates.length > 0) {
            state.trailPolyline.setLatLngs([...state.trailCoordinates, [curLat, curLon]]);
          }

          if (progress < 1) {
            state.animFrameId = requestAnimationFrame(step);
          } else {
            state.animFrameId = undefined;
          }
        };

        state.animFrameId = requestAnimationFrame(step);
      }
    });

  }, [sectors, units, reports, selectedUnitId, selectedReportId, blockages, showTraffic, tempClickCoord]);

  return (
    <div className={`border bg-[#050505] overflow-hidden transition-all duration-300 ${
      isMapFullscreen
        ? 'fixed inset-0 z-[9999] h-screen w-screen border-none'
        : 'relative w-full h-full border-[#00FF41]/30 shadow-[0_0_15px_rgba(0,255,65,0.1)]'
    }`}>
      {/* Dynamic Cursor / Placement Mode Toolbar */}
      <div className="absolute top-14 left-3 z-1000 flex flex-col gap-1 bg-[#0a0a0a]/95 border border-[#00FF41]/30 p-1.5 shadow-[0_0_15px_rgba(0,255,65,0.1)]">
        <div className="text-[7.5px] font-mono text-[#00FF41]/60 font-black text-center mb-1 pb-1 border-b border-[#00FF41]/20 uppercase tracking-widest">
          {lang === 'es' ? 'Herramientas' : 'Tools'}
        </div>
        
        {/* Navigation / Default cursor mode button */}
        <button
          onClick={() => {
            setActionMode('navigate');
            setTempClickCoord(null);
          }}
          className={`p-1.5 border transition-all cursor-pointer flex items-center justify-center rounded-none relative group ${
            actionMode === 'navigate'
              ? 'bg-[#00FF41]/20 text-[#00FF41] border-[#00FF41]'
              : 'bg-black text-stone-500 border-stone-900 hover:border-[#00FF41]/55 hover:text-[#00FF41]/90'
          }`}
          title={lang === 'es' ? 'Herramienta de Selección' : 'Select / Inspect Tool'}
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span className="absolute left-full ml-2 px-1.5 py-0.5 bg-black border border-[#00FF41]/30 text-[8px] text-[#00FF41] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-1000 rounded-none uppercase">
            {lang === 'es' ? 'Navegación' : 'Navigation Mode'}
          </span>
        </button>

        {/* Deploy base station mode button */}
        <button
          onClick={() => {
            setActionMode('place_station');
            setTempClickCoord(null);
          }}
          className={`p-1.5 border transition-all cursor-pointer flex items-center justify-center rounded-none relative group ${
            actionMode === 'place_station'
              ? 'bg-[#00FF41]/25 text-[#00FF41] border-[#00FF41] shadow-[0_0_8px_rgba(0,255,65,0.2)] font-bold'
              : 'bg-black text-stone-500 border-stone-900 hover:border-[#00FF41]/55 hover:text-[#00FF41]/90'
          }`}
          title={lang === 'es' ? 'Operacionalizar Nueva Estación Base' : 'Deploy Base Station Tool'}
        >
          <Building className="w-3.5 h-3.5" />
          <span className="absolute left-full ml-2 px-1.5 py-0.5 bg-black border border-[#00FF41]/30 text-[8px] text-[#00FF41] font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-1000 rounded-none uppercase">
            {lang === 'es' ? 'Desplegar Estación Base' : 'Deploy Base Station'}
          </span>
        </button>

        {/* Deploy incident mode button */}
        <button
          onClick={() => {
            setActionMode('place_incident');
            setTempClickCoord(null);
          }}
          className={`p-1.5 border transition-all cursor-pointer flex items-center justify-center rounded-none relative group ${
            actionMode === 'place_incident'
              ? 'bg-red-500/20 text-red-400 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)] font-bold'
              : 'bg-black text-stone-500 border-stone-900 hover:border-red-400/55 hover:text-red-400/90'
          }`}
          title={lang === 'es' ? 'Reportar Emergencia en Mapa' : 'Report Emergency Tool'}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="absolute left-full ml-2 px-1.5 py-0.5 bg-black border border-red-500/30 text-[8px] text-red-400 font-mono whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-1000 rounded-none uppercase">
            {lang === 'es' ? 'Transmitir Incidente' : 'Transmit Incident'}
          </span>
        </button>
      </div>

      {/* Dynamic Click-to-Place Context Dialogues */}
      {tempClickCoord && (
        <div className="absolute bottom-12 left-4 z-1000 w-72 bg-black/95 border border-[#00FF41]/40 p-4 font-mono shadow-[0_0_25px_rgba(0,255,65,0.2)] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex justify-between items-center border-b border-[#00FF41]/30 pb-2 mb-3">
            <span className="text-[#00FF41] font-black text-xs uppercase tracking-wider">
              {actionMode === 'place_station' 
                ? (lang === 'es' ? '⚙️ DEPLOY BASE TÁCTICA' : '⚙️ DEPLOY TACTICAL BASE')
                : (lang === 'es' ? '🚨 TRANSMITIR ALERTA' : '🚨 TRANSMIT INCIDENT')}
            </span>
            <button
              onClick={() => {
                setTempClickCoord(null);
                setActionMode('navigate');
              }}
              className="text-stone-500 hover:text-red-400 font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-[10px] text-stone-400 mb-3 bg-[#0a0a0a] p-1.5 border border-stone-900 leading-normal">
            <div>LAT: {tempClickCoord.lat.toFixed(5)}</div>
            <div>LON: {tempClickCoord.lon.toFixed(5)}</div>
          </div>

          {actionMode === 'place_station' ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-stone-400 uppercase font-bold">{lang === 'es' ? 'Nombre Estación:' : 'Station Name:'}</label>
                <input
                  type="text"
                  id="map-station-name"
                  placeholder="e.g. STATION ALPHA"
                  className="bg-black border border-[#00FF41]/20 p-1.5 text-xxs text-[#00FF41] focus:outline-none focus:border-[#00FF41] uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-stone-400 uppercase font-bold">{lang === 'es' ? 'Riesgo (0.1-1.0):' : 'Risk (0.1-1.0):'}</label>
                  <input
                    type="number"
                    id="map-station-risk"
                    defaultValue="0.5"
                    step="0.1"
                    min="0.1"
                    max="1.0"
                    className="bg-black border border-[#00FF41]/20 p-1 text-xxs text-[#00FF41] focus:outline-none focus:border-[#00FF41]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-stone-400 uppercase font-bold">{lang === 'es' ? 'Densidad Pob:' : 'Pop Density:'}</label>
                  <input
                    type="number"
                    id="map-station-density"
                    defaultValue="12000"
                    step="1000"
                    className="bg-black border border-[#00FF41]/20 p-1 text-xxs text-[#00FF41] focus:outline-none focus:border-[#00FF41]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-2">
                <label className="text-[9px] text-stone-400 uppercase font-bold">{lang === 'es' ? 'Vehículos Iniciales:' : 'Initial Vehicles:'}</label>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="map-unit-fire" defaultChecked className="accent-[#00FF41]" />
                    <span>🚒 {lang === 'es' ? 'Bomba' : 'Fire'}</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="map-unit-rescue" className="accent-[#00FF41]" />
                    <span>🛠️ {lang === 'es' ? 'Rescate' : 'Rescue'}</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="map-unit-med" className="accent-[#00FF41]" />
                    <span>🚑 {lang === 'es' ? 'Med' : 'Med'}</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="map-unit-haz" className="accent-[#00FF41]" />
                    <span>☣️ Haz</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nameInput = document.getElementById('map-station-name') as HTMLInputElement;
                  const name = nameInput?.value?.trim() || `BASE ${Math.floor(Math.random() * 900 + 100)}`;
                  const riskInput = document.getElementById('map-station-risk') as HTMLInputElement;
                  const risk = parseFloat(riskInput?.value) || 0.5;
                  const densityInput = document.getElementById('map-station-density') as HTMLInputElement;
                  const density = parseInt(densityInput?.value) || 12000;

                  const fire = (document.getElementById('map-unit-fire') as HTMLInputElement)?.checked;
                  const rescue = (document.getElementById('map-unit-rescue') as HTMLInputElement)?.checked;
                  const med = (document.getElementById('map-unit-med') as HTMLInputElement)?.checked;
                  const haz = (document.getElementById('map-unit-haz') as HTMLInputElement)?.checked;

                  const unitsList: { name: string; type: string }[] = [];
                  const sfx = name.substring(0, 4).toUpperCase();
                  if (fire) unitsList.push({ name: `BOMBA-${sfx}`, type: 'fire_truck' });
                  if (rescue) unitsList.push({ name: `RESCATE-${sfx}`, type: 'heavy_rescue' });
                  if (med) unitsList.push({ name: `MED-${sfx}`, type: 'ambulance' });
                  if (haz) unitsList.push({ name: `QUIM-${sfx}`, type: 'hazmat' });

                  if (onAddBaseStation) {
                    onAddBaseStation({
                      name: name.toUpperCase(),
                      lat: tempClickCoord.lat,
                      lon: tempClickCoord.lon,
                      baseRisk: risk,
                      populationDensity: density,
                      units: unitsList,
                    });
                  }

                  setTempClickCoord(null);
                  setActionMode('navigate');
                }}
                className="w-full mt-3 py-2 bg-[#00FF41]/20 border border-[#00FF41] hover:bg-[#00FF41] hover:text-black transition-all text-white text-[10px] uppercase font-bold cursor-pointer rounded-none"
              >
                {lang === 'es' ? '🚀 OPERACIONALIZAR ESTACIÓN' : '🚀 OPERATIONALIZE STATION'}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-stone-400 uppercase font-bold">{lang === 'es' ? 'Tipo Incidente:' : 'Incident Type:'}</label>
                <select
                  id="map-incident-type"
                  className="bg-black border border-[#00FF41]/20 p-1.5 text-xxs text-[#00FF41] focus:outline-none focus:border-[#00FF41] rounded-none cursor-pointer"
                >
                  <option value="fire">🔥 {lang === 'es' ? 'INCENDIO ESTRUCTURAL' : 'STRUCTURAL FIRE'}</option>
                  <option value="medical">🚑 {lang === 'es' ? 'EMERGENCIA MÉDICA' : 'MEDICAL EMERGENCY'}</option>
                  <option value="chemical">☣️ {lang === 'es' ? 'PELIGRO HAZMAT' : 'HAZMAT OUTBREAK'}</option>
                  <option value="landslide">🌋 {lang === 'es' ? 'DERREMBE / DESLAVE' : 'LANDSLIDE / COLLAPSE'}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <label className="text-[9px] text-stone-400 uppercase font-bold">{lang === 'es' ? 'Descripción:' : 'Description:'}</label>
                <textarea
                  id="map-incident-desc"
                  placeholder="e.g. Active hazard reported"
                  rows={2}
                  className="bg-black border border-[#00FF41]/20 p-1.5 text-xxs text-[#00FF41] focus:outline-none focus:border-[#00FF41] resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-stone-400 uppercase font-bold">{lang === 'es' ? 'Precisión (m):' : 'Accuracy (m):'}</label>
                  <input
                    type="number"
                    id="map-incident-acc"
                    defaultValue="150"
                    step="10"
                    className="bg-black border border-[#00FF41]/20 p-1 text-xxs text-[#00FF41] focus:outline-none focus:border-[#00FF41]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-2">
                <label className="text-[9px] text-stone-400 uppercase font-bold">{lang === 'es' ? 'Recursos Solicitados:' : 'Requested Resources:'}</label>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="map-req-fire" defaultChecked className="accent-[#00FF41]" />
                    <span>🚒 Bomba</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="map-req-rescue" className="accent-[#00FF41]" />
                    <span>🛠️ Rescate</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="map-req-med" className="accent-[#00FF41]" />
                    <span>🚑 Med</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" id="map-req-haz" className="accent-[#00FF41]" />
                    <span>☣️ Haz</span>
                  </label>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const type = (document.getElementById('map-incident-type') as HTMLSelectElement)?.value || 'fire';
                  const descInput = document.getElementById('map-incident-desc') as HTMLTextAreaElement;
                  const desc = descInput?.value?.trim() || (lang === 'es' ? 'Alerta de incidente táctico' : 'Tactical incident alert');
                  const accInput = document.getElementById('map-incident-acc') as HTMLInputElement;
                  const accuracy = parseInt(accInput?.value) || 150;

                  const fire = (document.getElementById('map-req-fire') as HTMLInputElement)?.checked;
                  const rescue = (document.getElementById('map-req-rescue') as HTMLInputElement)?.checked;
                  const med = (document.getElementById('map-req-med') as HTMLInputElement)?.checked;
                  const haz = (document.getElementById('map-req-haz') as HTMLInputElement)?.checked;

                  const reqVehicles = { fire_truck: fire, heavy_rescue: rescue, ambulance: med, hazmat: haz };

                  if (onAddIncident) {
                    onAddIncident({
                      id: `rep-${Date.now()}`,
                      type,
                      lat: tempClickCoord.lat,
                      lon: tempClickCoord.lon,
                      accuracy,
                      timestamp: Date.now(),
                      networkSignature: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                      status: 'pending',
                      description: desc,
                      isSimulation: isSimulation,
                      requestedVehicles: reqVehicles,
                    });
                  }

                  setTempClickCoord(null);
                  setActionMode('navigate');
                }}
                className="w-full mt-3 py-2 bg-red-500/20 border border-red-500 hover:bg-red-500 hover:text-black transition-all text-white text-[10px] uppercase font-bold cursor-pointer rounded-none"
              >
                {lang === 'es' ? '🚨 INICIAR PROTOCOLO' : '🚨 TRANSMIT INCIDENT'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Absolute top HUD indicators */}
      <div className="absolute top-3 left-3 z-1000 bg-[#0a0a0a]/90 backdrop-blur-md px-3 py-1.5 border border-[#00FF41]/30 text-xxs font-mono flex items-center gap-4 text-[#00FF41]">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#00FF41] animate-pulse"></span>
          <span>
            {lang === 'es'
              ? `SISTEMA ${isSimulation ? 'SIMULACRO' : 'VIVO'}`
              : `SYSTEM ${isSimulation ? 'SIMULATION' : 'LIVE'}`}
          </span>
        </div>
        <div className="h-3 w-px bg-[#00FF41]/20"></div>
        <div>
          {(() => {
            const rawRegion = sectors[0]?.name || '';
            const match = rawRegion.match(/\(([^)]+)\)/);
            const activeRegionName = match ? match[1] : (lang === 'es' ? 'LOCAL' : 'LOCAL');
            return lang === 'es'
              ? `CONCENTRADOR SENSORES ${activeRegionName.toUpperCase()}`
              : `${activeRegionName.toUpperCase()} SENSOR HUB`;
          })()}
        </div>
        <div className="h-3 w-px bg-[#00FF41]/20"></div>
        <div>
          {lang === 'es'
            ? `Vectores: ${reports.filter(r => r.status !== 'resolved').length} Activos`
            : `Vectors: ${reports.filter(r => r.status !== 'resolved').length} Active`}
        </div>
      </div>
 
      <div ref={mapContainerRef} className="w-full h-full" id="mission-map-container" />
 
      {/* Map coordinate grid watermarks */}
      <div className="absolute bottom-3 left-3 z-1000 pointer-events-none text-xxs font-mono text-[#00FF41]/50">
        {(() => {
          const centerLat = sectors[0]?.center[0] ?? 19.4326;
          const centerLon = sectors[0]?.center[1] ?? -99.1332;
          return `RADAR LAT: ${Math.abs(centerLat).toFixed(4)}°${centerLat >= 0 ? 'N' : 'S'} | LON: ${Math.abs(centerLon).toFixed(4)}°${centerLon >= 0 ? 'E' : 'W'}`;
        })()}
      </div>
 
      {/* Absolute Layer Toggle Controls Container */}
      <div className="absolute top-3 right-3 z-1000 flex items-center gap-1.5">
        {/* Dynamic Traffic Layer Toggle Control */}
        <button
          id="toggle-traffic-layer"
          onClick={() => setShowTraffic(!showTraffic)}
          className={`px-2.5 py-1.5 font-mono text-[9px] border flex items-center gap-1.5 transition-all cursor-pointer rounded-none uppercase shadow-[0_0_8px_rgba(0,255,65,0.05)] ${
            showTraffic
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/50 shadow-[0_0_12px_rgba(249,115,22,0.15)] font-bold'
              : 'bg-[#0a0a0a]/90 text-stone-500 border-stone-800 hover:border-stone-600 hover:text-stone-300'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${showTraffic ? 'bg-orange-400 animate-pulse' : 'bg-stone-600'}`}></span>
          <span>{lang === 'es' ? 'Capa Tránsito' : 'Traffic Layer'}</span>
        </button>

        {/* Fullscreen Toggle Button */}
        <button
          onClick={() => setIsMapFullscreen(!isMapFullscreen)}
          className="px-2.5 py-1.5 font-mono text-[9px] border flex items-center gap-1.5 transition-all cursor-pointer rounded-none uppercase shadow-[0_0_8px_rgba(0,255,65,0.05)] bg-[#0a0a0a]/90 border-stone-800 hover:border-[#00FF41]/60 text-stone-400 hover:text-white"
          title={isMapFullscreen ? (lang === 'es' ? 'Salir de pantalla completa' : 'Exit Fullscreen') : (lang === 'es' ? 'Pantalla Completa' : 'Fullscreen')}
        >
          {isMapFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-[#FF4444]" />
              <span>{lang === 'es' ? 'Cerrar F.Screen' : 'Exit F.Screen'}</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-[#00FF41]" />
              <span>{lang === 'es' ? 'Pantalla Completa' : 'Fullscreen'}</span>
            </>
          )}
        </button>
      </div>

      {/* Custom styled cyberpunk zoom buttons */}
      <div className="absolute bottom-3 right-3 z-1000 flex flex-col gap-1.5">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          className="w-7 h-7 bg-[#0a0a0a]/90 hover:bg-[#00FF41]/20 border border-[#00FF41]/30 hover:border-[#00FF41]/60 text-[#00FF41] hover:text-white font-mono font-bold flex items-center justify-center transition-all cursor-pointer text-sm shadow-[0_0_8px_rgba(0,255,65,0.1)] rounded-none"
          title={lang === 'es' ? 'Acercar' : 'Zoom In'}
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          className="w-7 h-7 bg-[#0a0a0a]/90 hover:bg-[#00FF41]/20 border border-[#00FF41]/30 hover:border-[#00FF41]/60 text-[#00FF41] hover:text-white font-mono font-bold flex items-center justify-center transition-all cursor-pointer text-sm shadow-[0_0_8px_rgba(0,255,65,0.1)] rounded-none"
          title={lang === 'es' ? 'Alejar' : 'Zoom Out'}
        >
          −
        </button>
      </div>
    </div>
  );
}
