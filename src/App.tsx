/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  EmergencyReport,
  FleetUnit,
  CoverageSector,
  RealtimeMessage,
  SimulationConfig,
  SimulationResult,
  DrillSession,
  UserPerformance,
  EmergencyType,
  DisasterType
} from './types';
import CommandMap from './components/CommandMap';
import CopilotView from './components/CopilotView';
import GlobalOperationsDashboard from './components/GlobalOperationsDashboard';
import AutonomousDecisionLedger from './components/AutonomousDecisionLedger';
import {
  auth as firebaseAuth,
  db,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from './firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import {
  Shield,
  Activity,
  Flame,
  Biohazard,
  AlertTriangle,
  Radio,
  Clock,
  Gauge,
  User,
  Zap,
  RotateCcw,
  BarChart3,
  Award,
  PlusCircle,
  Play,
  Square,
  Sparkles,
  ExternalLink,
  ChevronRight,
  MapPin,
  TrendingDown,
  Heart,
  Volume2,
  VolumeX,
  Smartphone,
  Check,
  Languages,
  HelpCircle,
  Cpu,
  FileText,
  Truck,
  Settings,
  Eye,
  Building,
  Github,
  Download
} from 'lucide-react';

export default function App() {
  // Firebase Auth & User Integrity State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authIsRegister, setAuthIsRegister] = useState<boolean>(false);
  const [authBadgeId, setAuthBadgeId] = useState<string>('DEPUTY_OFFICER_01');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [bypassAuth, setBypassAuth] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('soae_bypass_auth') === 'true';
    }
    return false;
  });
  const [appTheme, setAppTheme] = useState<'cyberpunk' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('soae_theme') as 'cyberpunk' | 'light') || 'cyberpunk';
    }
    return 'cyberpunk';
  });

  // State for operational real-world mode
  const [sectors, setSectors] = useState<CoverageSector[]>([]);
  const [units, setUnits] = useState<FleetUnit[]>([]);
  const [reports, setReports] = useState<EmergencyReport[]>([]);

  // Selected Region center
  const [currentRegion, setCurrentRegion] = useState<{ lat: number; lon: number; regionName: string }>({
    lat: 19.4326,
    lon: -99.1332,
    regionName: 'Autodetect by GPS'
  });
  
  // State for Dead-man switches
  const [activeDms, setActiveDms] = useState<Map<string, number>>(new Map());

  // State for Autonomous decisions
  const [autonomousDecisions, setAutonomousDecisions] = useState<any[]>([]);

  // State for Training Sandbox (isolated state)
  const [drillSectors, setDrillSectors] = useState<CoverageSector[]>([]);
  const [drillUnits, setDrillUnits] = useState<FleetUnit[]>([]);
  const [drillReports, setDrillReports] = useState<EmergencyReport[]>([]);
  const [drillSession, setDrillSession] = useState<DrillSession | null>(null);

  // Active View Tab: 'ops' (Mando Central), 'tablet' (Copilot Tablet), 'sim' (Gemelo Stress-test), 'drill' (Sandox Training), 'citizen' (Portal Ciudadano SOS), 'dashboard' (Global Operations)
  const [activeTab, setActiveTab] = useState<'ops' | 'tablet' | 'sim' | 'drill' | 'citizen' | 'dashboard' | 'decisions'>('ops');

  // Application language selection state: 'es' (Spanish), 'en' (English)
  const [lang, setLang] = useState<'es' | 'en'>('es');

  // Interactive Explanations & Tooltip States
  const [showRviHelp, setShowRviHelp] = useState<boolean>(false);
  const [showDmsHelp, setShowDmsHelp] = useState<boolean>(false);
  const [showSoaeHelp, setShowSoaeHelp] = useState<boolean>(false);

  // Citizen SOS specific states
  const [citizenCoords, setCitizenCoords] = useState<{ lat: number; lon: number; accuracy: number | null } | null>(null);
  const [citizenLocating, setCitizenLocating] = useState<boolean>(false);
  const [voiceGuidance, setVoiceGuidance] = useState<boolean>(true);
  const [shatteredScreenMode, setShatteredScreenMode] = useState<boolean>(false);
  const [activeCitizenReportId, setActiveCitizenReportId] = useState<string | null>(null);
  const [citizenCustomComment, setCitizenCustomComment] = useState<string>('');
  const [citizenRequestVehicles, setCitizenRequestVehicles] = useState<{
    fire_truck: boolean;
    ambulance: boolean;
    heavy_rescue: boolean;
    hazmat: boolean;
  }>({
    fire_truck: false,
    ambulance: false,
    heavy_rescue: false,
    hazmat: false
  });

  // Simulation controls state
  const [simConfig, setSimConfig] = useState<SimulationConfig>({
    type: 'earthquake',
    lat: 19.4326,
    lon: -99.1332,
    radius: 5,
    magnitude: 7.5,
    populationAffected: 125000
  });
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Drill management configuration state
  const [drillName, setDrillName] = useState<string>('Simulacro Coordinado de Desastre');
  const [traineeName, setTraineeName] = useState<string>('Operador_Alpha_01');
  const [drillDuration, setDrillDuration] = useState<number>(90); // 90 seconds
  const [drillPerformance, setDrillPerformance] = useState<UserPerformance | null>(null);

  // Incident reporting fields state
  const [newReportType, setNewReportType] = useState<EmergencyType>('fire');
  const [newReportLat, setNewReportLat] = useState<number>(19.4326);
  const [newReportLon, setNewReportLon] = useState<number>(-99.1332);
  const [newReportDesc, setNewReportDesc] = useState<string>('');
  
  // Tactical list selections
  const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>(undefined);
  const [optimizationAdvice, setOptimizationAdvice] = useState<{
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
  } | null>(null);

  // Active route blockages
  const [opsBlockages, setOpsBlockages] = useState<{ id: string; lat: number; lon: number; timestamp: number }[]>([]);
  const [drillBlockages, setDrillBlockages] = useState<{ id: string; lat: number; lon: number; timestamp: number }[]>([]);

  // WebSockets Connection State
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const lastAnnouncedEventRef = useRef<string>('');

  // System warning log banner
  const [systemAlerts, setSystemAlerts] = useState<{ id: string; msg: string; type: 'warning' | 'info' | 'danger' }[]>([]);

  // Config settings modal visibility
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'system' | 'audio' | 'privacy' | 'location' | 'stations' | 'github'>('system');

  // Zoom and pan state for map focus on double-click
  const [focusedLocation, setFocusedLocation] = useState<{ lat: number; lon: number; timestamp: number } | null>(null);

  // Map Click-to-Place Tool Callback Handlers
  const handleMapAddBaseStation = (payload: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addSystemLog(
        lang === 'es'
          ? 'Enlace satelital fuera de línea. No se pudo registrar la base.'
          : 'Satellite link offline. Could not register base.',
        'danger'
      );
      return;
    }
    socketRef.current.send(JSON.stringify({
      type: 'base_station_added',
      payload,
      isSimulation: activeTab === 'drill'
    }));
    addSystemLog(
      lang === 'es'
        ? `COMANDO: Enviando solicitud de registro de base operativa ${payload.name.toUpperCase()}...`
        : `COMMAND: Submitting operational registration request for base station ${payload.name.toUpperCase()}...`,
      'info'
    );
    if (voiceGuidance) {
      speakInstruction(
        lang === 'es'
          ? `Comando de instalación de base enviado.`
          : `Base station deployment command submitted.`
      );
    }
  };

  const handleMapAddIncident = (payload: any) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addSystemLog(
        lang === 'es'
          ? 'Enlace satelital fuera de línea. No se pudo reportar el incidente.'
          : 'Satellite link offline. Could not report incident.',
        'danger'
      );
      return;
    }

    const reportId = payload.id || `rep-${Date.now()}`;
    const enrichedPayload = { ...payload, id: reportId };

    if ((user || bypassAuth) && activeTab !== 'drill') {
      const reportDocRef = doc(db, 'incidents', reportId);
      setDoc(reportDocRef, { ...enrichedPayload, reportedBy: user ? user.uid : 'bypass_student' }).catch(err => {
        console.error("Failed to write to Firestore:", err);
      });
    }

    socketRef.current.send(JSON.stringify({
      type: 'emergency_reported',
      payload: enrichedPayload,
      isSimulation: activeTab === 'drill'
    }));
    addSystemLog(
      lang === 'es'
        ? `▲ EMERGENCIA DE MAPA REPORTADA: ${payload.type.toUpperCase()} - Iniciando Dead-man's switch`
        : `▲ MAP EMERGENCY REPORTED: ${payload.type.toUpperCase()} - Triggering Dead-man's switch`,
      'danger'
    );
    triggerTacticalAlertSound();
    if (voiceGuidance) {
      speakInstruction(
        lang === 'es'
          ? `Alerta de incidente táctico transmitido con éxito.`
          : `Tactical incident alert successfully transmitted.`
      );
    }
  };

  // Manual Base Station registration states
  const [stationFormName, setStationFormName] = useState<string>('');
  const [stationFormLat, setStationFormLat] = useState<string>('');
  const [stationFormLon, setStationFormLon] = useState<string>('');
  const [stationFormRisk, setStationFormRisk] = useState<number>(0.5);
  const [stationFormDensity, setStationFormDensity] = useState<number>(10000);
  const [stationFormUnits, setStationFormUnits] = useState<{
    fire_truck: boolean;
    heavy_rescue: boolean;
    ambulance: boolean;
    hazmat: boolean;
  }>({
    fire_truck: true,
    heavy_rescue: false,
    ambulance: false,
    hazmat: false,
  });

  // High contrast accessibility mode
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('soae_high_contrast') === 'true';
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('soae_high_contrast', String(highContrast));
  }, [highContrast]);

  // Biometric monitor states
  const [biometricConsent, setBiometricConsent] = useState<boolean>(false);
  const [biometricHeartRate, setBiometricHeartRate] = useState<number>(74);
  const [biometricOxygen, setBiometricOxygen] = useState<number>(98);
  const [biometricActivity, setBiometricActivity] = useState<string>('resting'); // resting, active, crash_detected, critical_low
  const [biometricCountdown, setBiometricCountdown] = useState<number | null>(null);

  // Vitals simulation interval
  useEffect(() => {
    if (!biometricConsent || biometricCountdown !== null) return;
    
    const interval = setInterval(() => {
      setBiometricHeartRate(prev => {
        const change = Math.floor(Math.random() * 5) - 2;
        const next = prev + change;
        return Math.max(65, Math.min(95, next));
      });
      setBiometricOxygen(prev => {
        const change = Math.floor(Math.random() * 3) - 1;
        const next = prev + change;
        return Math.max(96, Math.min(100, next));
      });
      // Random activity state
      setBiometricActivity(prev => Math.random() > 0.7 ? (Math.random() > 0.5 ? 'active' : 'resting') : prev);
    }, 3000);

    return () => clearInterval(interval);
  }, [biometricConsent, biometricCountdown]);

  // Countdown decrement timeout for biometric critical inactive check
  useEffect(() => {
    let timer: any;
    if (biometricCountdown !== null) {
      if (biometricCountdown > 0) {
        timer = setTimeout(() => {
          setBiometricCountdown(prev => (prev !== null ? prev - 1 : null));
        }, 1000);
      } else {
        // Countdown reached 0! Trigger emergency!
        setBiometricCountdown(null);
        setBiometricHeartRate(32);
        setBiometricOxygen(85);
        setBiometricActivity('critical_low');
        
        // Trigger emergency
        const descText = lang === 'es'
          ? `🩺 [ALERTA BIOMÉTRICA AUTÓNOMA] El biosensor reportó un colapso vital severo (Frecuencia cardíaca: 32 lpm, Oxígeno: 85%) seguido de impacto gravitatorio de desaceleración y pérdida de respuesta táctil.`
          : `🩺 [AUTONOMOUS BIOMETRIC SOS] Wear-device reported vital collapse (Heart Rate: 32 bpm, SpO2: 85%) followed by high-impact deceleration & no tactile response.`;
        
        handleCitizenSOS('medical', descText);
        
        addSystemLog(
          lang === 'es'
            ? '🚨 TRANSMISIÓN AUTÓNOMA: Se emitió auxilio biométrico satelital al detectarse inactividad del ciudadano tras impacto de gravedad.'
            : '🚨 AUTONOMOUS TRANSMISSION: Satellite channel emitted biometric SOS due to citizen unresponsiveness after severe impact.',
          'danger'
        );
        if (voiceGuidance) {
          speakInstruction(
            lang === 'es'
              ? 'Alerta vital autónoma transmitida. Iniciando operaciones de auxilio.'
              : 'Autonomous vital alert broadcasted. Starting rescue operations.'
          );
        }
      }
    }
    return () => clearTimeout(timer);
  }, [biometricCountdown, lang, voiceGuidance]);

  // Sound effects / auditory HUD alerts helper
  const triggerTacticalAlertSound = () => {
    try {
      // Gentle operational synthesized click
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
  };

  const handleChangeRegion = async (lat: number, lon: number, regionName: string) => {
    try {
      const res = await fetch('/api/system/region', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, regionName })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentRegion({ lat: data.lat, lon: data.lon, regionName: data.regionName });
        setNewReportLat(data.lat);
        setNewReportLon(data.lon);
        setSimConfig(prev => ({ ...prev, lat: data.lat, lon: data.lon }));
        addSystemLog(
          lang === 'es'
            ? `Sectores reconfigurados alrededor de: ${regionName}`
            : `Sectors reconfigured around: ${regionName}`,
          'info'
        );
        if (voiceGuidance) {
          speakInstruction(
            lang === 'es'
              ? `Red táctica reubicada a ${regionName}.`
              : `Tactical network relocated to ${regionName}.`
          );
        }
      }
    } catch (error) {
      console.error('Error switching region:', error);
    }
  };

  const detectCurrentLocation = async (): Promise<{ lat: number; lon: number; regionName: string } | null> => {
    // 1. Try IPAPI.co (highly reliable, returns lat/lon/city/country)
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          const cityPart = data.city ? `${data.city}` : '';
          const countryPart = data.country_code || data.country_name || '';
          const regionName = cityPart && countryPart ? `${cityPart} (${countryPart})` : (cityPart || countryPart || 'Local Position');
          return { lat: data.latitude, lon: data.longitude, regionName };
        }
      }
    } catch (e) {
      console.warn('IPAPI detection failed, trying backup...', e);
    }

    // 2. Try IPWHO.is as a solid backup
    try {
      const response = await fetch('https://ipwho.is/');
      if (response.ok) {
        const data = await response.json();
        if (data && data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          const cityPart = data.city ? `${data.city}` : '';
          const countryPart = data.country_code || data.country || '';
          const regionName = cityPart && countryPart ? `${cityPart} (${countryPart})` : (cityPart || countryPart || 'Local Position');
          return { lat: data.latitude, lon: data.longitude, regionName };
        }
      }
    } catch (e) {
      console.warn('IPWHO detection failed, trying browser GPS...', e);
    }

    // 3. Try standard Geolocation API as final fallback
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000
          });
        });
        return {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          regionName: lang === 'es' ? 'Ubicación GPS' : 'GPS Location'
        };
      } catch (e) {
        console.warn('Browser Geolocation API failed:', e);
      }
    }

    return null;
  };

  const handleAutodetectRegion = async () => {
    addSystemLog(
      lang === 'es' ? 'Consultando sensores satelitales para ubicación local...' : 'Consulting satellite sensors for local position...',
      'info'
    );
    const detected = await detectCurrentLocation();
    if (detected) {
      await handleChangeRegion(detected.lat, detected.lon, detected.regionName);
    } else {
      addSystemLog(
        lang === 'es' ? 'Señal GPS e IP no disponibles. Usando coordenadas operativas del servidor.' : 'GPS & IP signals unavailable. Using operational server coordinates.',
        'warning'
      );
    }
  };

  // Fetch current region on boot
  useEffect(() => {
    const fetchRegionOnBoot = async () => {
      try {
        const res = await fetch('/api/system/region');
        if (res.ok) {
          const data = await res.json();
          setCurrentRegion({ lat: data.lat, lon: data.lon, regionName: data.regionName });
          setNewReportLat(data.lat);
          setNewReportLon(data.lon);
          setSimConfig(prev => ({ ...prev, lat: data.lat, lon: data.lon }));

          // If region is generic or default 'Autodetect by GPS', trigger the silent/automatic local detection
          if (data.regionName === 'Autodetect by GPS' || data.regionName === 'Autodetectar por GPS') {
            addSystemLog(
              lang === 'es' ? 'SISTEMA: Iniciando autodetección de geolocalización de fondo...' : 'SYSTEM: Initiating background geolocation autodetect...',
              'info'
            );
            const detected = await detectCurrentLocation();
            if (detected) {
              await handleChangeRegion(detected.lat, detected.lon, detected.regionName);
            } else {
              addSystemLog(
                lang === 'es' ? 'SISTEMA: No se pudo detectar ubicación automáticamente. Usando CDMX (MEX).' : 'SYSTEM: Could not autodetect location. Defaulting to CDMX (MEX).',
                'warning'
              );
              await handleChangeRegion(19.4326, -99.1332, 'CDMX (MÉXICO)');
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch initial region from server:', err);
      }
    };
    fetchRegionOnBoot();
  }, []);

  // 1. Firebase Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        addSystemLog(
          lang === 'es'
            ? `SISTEMA: Identidad de operador verificada (${firebaseUser.email || 'Canal Ciudadano SOS'}).`
            : `SYSTEM: Operator identity verified (${firebaseUser.email || 'SOS Citizen Channel'}).`,
          'info'
        );
      }
    });
    return () => unsubscribe();
  }, [lang]);

  // 2. Real-time Firestore sync of Live Incidents (Active when authenticated or bypassed)
  useEffect(() => {
    if (!user && !bypassAuth) {
      return;
    }
    const q = query(collection(db, 'incidents'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbReports: EmergencyReport[] = [];
      snapshot.forEach((doc) => {
        const item = doc.data() as EmergencyReport;
        dbReports.push(item);
      });
      if (dbReports.length > 0) {
        setReports(dbReports);
      }
    }, (error) => {
      console.error("Firestore sync error:", error);
    });
    return () => unsubscribe();
  }, [user, bypassAuth]);

  // 3. Auto-sign in anonymously if user visits the Citizen SOS Portal and is not signed in
  useEffect(() => {
    if (activeTab === 'citizen' && !user) {
      addSystemLog(
        lang === 'es' ? 'SISTEMA: Iniciando firma digital de ciudadano...' : 'SYSTEM: Initializing citizen digital signature...',
        'info'
      );
      signInAnonymously(firebaseAuth)
        .catch(err => {
          if (err?.code === 'auth/operation-not-allowed') {
            console.warn("Firebase Anonymous Auth is not enabled in the Firebase Console. Standard offline operations will be used as a fallback.");
            addSystemLog(
              lang === 'es'
                ? 'ADVERTENCIA: Autenticación anónima deshabilitada en Firebase. Canal Ciudadano usando modo offline local.'
                : 'WARNING: Firebase Anonymous Authentication disabled. Citizen SOS Channel running in local offline-fallback mode.',
              'warning'
            );
          } else {
            console.error("Anonymous sign in failed:", err);
          }
        });
    }
  }, [activeTab, user, lang]);

  // Connect WebSockets
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    const wsUrl = `${protocol}${window.location.host}`;
    
    const connect = () => {
      console.log(`Establishing telemetry handshake with ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setSocketConnected(true);
        addSystemLog('Enlace satelital de misión crítica establecido.', 'info');
      };

      ws.onclose = () => {
        setSocketConnected(false);
        addSystemLog('Enlace satelital desconectado. Reintentando sincronización...', 'warning');
        setTimeout(connect, 4000);
      };

      ws.onmessage = (event) => {
        try {
          const msg: RealtimeMessage = JSON.parse(event.data);
          const isSim = !!msg.isSimulation;

          switch (msg.type) {
            case 'init_state': {
              const data = msg.payload;
              setSectors(data.sectors || []);
              setUnits(data.units || []);
              setReports(data.reports || []);
              setDrillSectors(data.drillSectors || []);
              setDrillUnits(data.drillUnits || []);
              setDrillReports(data.drillReports || []);
              setDrillSession(data.drillSession || null);
              setAutonomousDecisions(data.autonomousDecisions || []);
              
              const switchesMap = new Map<string, number>();
              if (data.activeSwitches) {
                data.activeSwitches.forEach((s: any) => switchesMap.set(s.reportId, s.timeLeft));
              }
              setActiveDms(switchesMap);
              break;
            }

            case 'emergency_reported': {
              triggerTacticalAlertSound();
              if (isSim) {
                setDrillReports(prev => {
                  if (prev.find(r => r.id === msg.payload.id)) return prev;
                  return [msg.payload, ...prev];
                });
                addSystemLog(`[SIMULACRO] Emergencia programada detectada: ${msg.payload.type.toUpperCase()}`, 'info');
                setActiveTab('drill');
              } else {
                setReports(prev => {
                  if (prev.find(r => r.id === msg.payload.id)) return prev;
                  return [msg.payload, ...prev];
                });
                addSystemLog(`▲ EMERGENCIA VIVA DETECTADA: ${msg.payload.type.toUpperCase()} - Iniciando Dead-man's switch de seguridad`, 'danger');
                setActiveTab('ops');
              }
              setSelectedReportId(msg.payload.id);
              break;
            }

             case 'emergency_updated': {
              const updated = msg.payload;
              if (isSim) {
                setDrillReports(prev => prev.map(r => r.id === updated.id ? updated : r));
              } else {
                setReports(prev => prev.map(r => r.id === updated.id ? updated : r));
                if (updated.status === 'dispatched') {
                  // remove switch
                  setActiveDms(prev => {
                    const next = new Map(prev);
                    next.delete(updated.id);
                    return next;
                  });
                }
              }

              // Voice guidance announcements for dispatches or resolutions
              if (voiceGuidance) {
                if (updated.status === 'dispatched') {
                  const annKey = `${updated.id}-dispatched`;
                  if (lastAnnouncedEventRef.current !== annKey) {
                    lastAnnouncedEventRef.current = annKey;
                    
                    const allUnitsList = [...units, ...drillUnits];
                    const assignedUnit = allUnitsList.find(u => u.id === updated.assignedUnitId);
                    
                    if (assignedUnit) {
                      const typeLabelEs = assignedUnit.type === 'heavy_rescue' ? 'Unidad de Rescate Pesado' : assignedUnit.type === 'hazmat' ? 'Unidad de Materiales Peligrosos' : assignedUnit.type === 'ambulance' ? 'Ambulancia Avanzada' : 'Cuerpo de Bomberos';
                      const typeLabelEn = assignedUnit.type === 'heavy_rescue' ? 'Heavy Rescue Unit' : assignedUnit.type === 'hazmat' ? 'Hazmat Unit' : assignedUnit.type === 'ambulance' ? 'Advanced Ambulance' : 'Fire engine';
                      
                      const speakText = lang === 'es'
                        ? `Alerta táctica. ${typeLabelEs}, indicativo ${assignedUnit.name}, ha sido despachado oficialmente a incidente ${updated.id.substring(0, 6)}.`
                        : `Tactical dispatch alert. ${typeLabelEn}, callsign ${assignedUnit.name}, has been officially dispatched to incident ${updated.id.substring(0, 6)}.`;
                      speakInstruction(speakText);
                    }
                  }
                } else if (updated.status === 'resolved') {
                  const annKey = `${updated.id}-resolved`;
                  if (lastAnnouncedEventRef.current !== annKey) {
                    lastAnnouncedEventRef.current = annKey;
                    
                    const speakText = lang === 'es'
                      ? `Atención Mando Central. El incidente en cuadrante de emergencia ha sido resuelto con éxito. Zona asegurada.`
                      : `Attention Central Command. Incident in emergency quadrant has been successfully resolved. Sector secured.`;
                    speakInstruction(speakText);
                  }
                }
              }
              break;
            }

            case 'unit_telemetry': {
              const telemetry = msg.payload;
              if (isSim) {
                setDrillUnits(prev => prev.map(u => u.id === telemetry.id ? telemetry : u));
              } else {
                setUnits(prev => prev.map(u => u.id === telemetry.id ? telemetry : u));
              }

              // Voice announcement for manual or automatic Return to Base
              if (voiceGuidance && telemetry.activeMissionId === 'return-home') {
                const annKey = `${telemetry.id}-return-home-manual`;
                if (lastAnnouncedEventRef.current !== annKey) {
                  lastAnnouncedEventRef.current = annKey;
                  const speakText = lang === 'es'
                    ? `Atención Mando Central. Unidad ${telemetry.name} ha sido ordenada a retornar a base operativa con ruta optimizada.`
                    : `Attention Central Command. Unit ${telemetry.name} has been ordered to return to base depot with optimized transit routing.`;
                  speakInstruction(speakText);
                }
              }
              break;
            }

            case 'unit_route_blocked': {
              const { unitId, blockedCoord } = msg.payload;
              if (blockedCoord) {
                const newBlockage = {
                  id: `${unitId}-${Date.now()}`,
                  lat: blockedCoord[0],
                  lon: blockedCoord[1],
                  timestamp: Date.now()
                };
                if (isSim) {
                  setDrillBlockages(prev => [newBlockage, ...prev]);
                } else {
                  setOpsBlockages(prev => [newBlockage, ...prev]);
                }
              }
              break;
            }

            case 'dead_man_tick': {
              const { reportId, timeLeft } = msg.payload;
              setActiveDms(prev => {
                const next = new Map(prev);
                next.set(reportId, timeLeft);
                return next;
              });
              break;
            }

            case 'dead_man_triggered': {
              triggerTacticalAlertSound();
              const { report, unit, reasons } = msg.payload;
              addSystemLog(`⚡ [SILENT COMMIT AUTÓNOMO] Unidad ${unit.name} despachada a incidente ${report.id} por inacción humana.`, 'warning');
              
              setActiveDms(prev => {
                const next = new Map(prev);
                next.delete(report.id);
                return next;
              });

              if (voiceGuidance) {
                const annKey = `${report.id}-dispatched`;
                lastAnnouncedEventRef.current = annKey; // Prevent duplicate dispatch announcement
                
                const typeLabelEs = unit.type === 'heavy_rescue' ? 'Unidad de Rescate Pesado' : unit.type === 'hazmat' ? 'Unidad de Materiales Peligrosos' : unit.type === 'ambulance' ? 'Ambulancia Avanzada' : 'Cuerpo de Bomberos';
                const typeLabelEn = unit.type === 'heavy_rescue' ? 'Heavy Rescue Unit' : unit.type === 'hazmat' ? 'Hazmat Unit' : unit.type === 'ambulance' ? 'Advanced Ambulance' : 'Fire engine';
                
                const text = lang === 'es'
                  ? `Alerta crítica de inacción del operador. El núcleo del satélite ha iniciado un despacho autónomo de emergencia. Desplegando ${typeLabelEs}, indicativo ${unit.name}, para asegurar vidas.`
                  : `Critical operator inaction alert. The satellite core has initiated autonomous emergency dispatch. Deploying ${typeLabelEn}, callsign ${unit.name}, to secure lives.`;
                speakInstruction(text);
              }
              break;
            }

            case 'dead_man_reset': {
              const { reportId } = msg.payload;
              setActiveDms(prev => {
                const next = new Map(prev);
                next.delete(reportId);
                return next;
              });
              break;
            }

            case 'drill_started': {
              triggerTacticalAlertSound();
              setDrillSession(msg.payload);
              setDrillReports([]);
              setDrillPerformance(null);
              setDrillBlockages([]);
              addSystemLog('★ SIMULACRO OPERATIVO INICIADO: Servidores aislados WebSockets en línea.', 'info');
              break;
            }

            case 'drill_tick': {
              const status = msg.payload;
              setDrillSession(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  elapsedSeconds: status.elapsedSeconds,
                  duration: status.totalDuration
                };
              });
              break;
            }

            case 'drill_event_triggered': {
              triggerTacticalAlertSound();
              const report = msg.payload;
              setDrillReports(prev => {
                if (prev.find(r => r.id === report.id)) return prev;
                return [report, ...prev];
              });
              break;
            }

            case 'drill_stopped': {
              triggerTacticalAlertSound();
              const data = msg.payload;
              setDrillSession(data.session);
              setDrillPerformance(data.evaluation);
              addSystemLog('★ SIMULACRO DETENIDO: Reporte de desempeño generado.', 'info');
              break;
            }

            case 'simulation_run': {
              // Received stress test
              setSimResult(msg.payload);
              break;
            }

            case 'ivr_recalculated': {
              if (isSim) {
                setDrillSectors(msg.payload);
              } else {
                setSectors(msg.payload);
              }
              break;
            }

            case 'system_alert': {
              const { msg: alertMsg, type } = msg.payload;
              addSystemLog(alertMsg, type);
              break;
            }

            case 'autonomous_decision': {
              const decision = msg.payload;
              setAutonomousDecisions(prev => [decision, ...prev]);
              break;
            }
          }
        } catch (err) {
          console.error('Error handling WebSocket event:', err);
        }
      };
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  // System warning log banner helper
  const addSystemLog = (msg: string, type: 'warning' | 'info' | 'danger') => {
    const id = `log-${Date.now()}-${Math.random()}`;
    setSystemAlerts(prev => [{ id, msg, type }, ...prev].slice(0, 5));
  };

  // Run MILP Optimization recommendation search for selected Emergency Report
  useEffect(() => {
    if (!selectedReportId) {
      setOptimizationAdvice(null);
      return;
    }

    const report = (activeTab === 'drill' ? drillReports : reports).find(r => r.id === selectedReportId);
    if (!report) return;

    const controller = new AbortController();
    const { signal } = controller;

    // Call REST endpoint
    fetch('/api/optimization/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        report,
        isSimulation: activeTab === 'drill'
      }),
      signal
    })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (!signal.aborted) {
          setOptimizationAdvice(data);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Failed to resolve optimization advice:', err);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedReportId, activeTab]);

  // Handle client-side manual emergency reporting trigger
  const handleReportEmergency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    const reportId = `rep-${Date.now()}`;
    const signature = `sig-${newReportType}-${newReportLat.toFixed(4)}-${newReportLon.toFixed(4)}-${Date.now()}`;
    const reportData: EmergencyReport = {
      id: reportId,
      type: newReportType,
      lat: newReportLat,
      lon: newReportLon,
      accuracy: 10 + Math.floor(Math.random() * 15),
      timestamp: Date.now(),
      networkSignature: signature,
      status: 'pending',
      description: newReportDesc || `Reporte de emergencia ciudadana de tipo ${newReportType.toUpperCase()} detectado en cuadrante táctico.`,
      isSimulation: activeTab === 'drill'
    };

    if (user && activeTab !== 'drill') {
      const reportDocRef = doc(db, 'incidents', reportId);
      setDoc(reportDocRef, { ...reportData, reportedBy: user.uid }).catch(err => {
        console.error("Failed to write to Firestore:", err);
      });
    }

    socketRef.current.send(JSON.stringify({
      type: 'emergency_reported',
      payload: reportData,
      isSimulation: activeTab === 'drill'
    }));

    setNewReportDesc('');
  };

  // TTS voice synthesiser guidance
  const speakInstruction = (text: string, forceLang?: 'es' | 'en') => {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = (forceLang || lang) === 'es' ? 'es-ES' : 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech synthesis failure:', e);
    }
  };

  // Real-time Citizen Geolocation Tracker
  const acquireCitizenLocation = () => {
    if (!navigator.geolocation) {
      addSystemLog(
        lang === 'es'
          ? 'Geolocalización GPS no soportada en este explorador.'
          : 'GPS geolocation not supported in this browser.',
        'warning'
      );
      setCitizenCoords({ lat: currentRegion.lat, lon: currentRegion.lon, accuracy: 25 });
      return;
    }

    setCitizenLocating(true);

    const handleSuccess = (position: GeolocationPosition) => {
      setCitizenCoords({
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: Math.round(position.coords.accuracy)
      });
      setCitizenLocating(false);
      if (voiceGuidance) {
        speakInstruction(
          lang === 'es'
            ? 'Coordenadas GPS obtenidas con éxito. Su ubicación está asegurada.'
            : 'GPS coordinates successfully acquired. Your location is secured.'
        );
      }
    };

    const handleFailure = (error: GeolocationPositionError) => {
      console.warn('High accuracy GPS acquisition failed, retrying with standard accuracy...', error);
      
      // Retry with enableHighAccuracy: false
      navigator.geolocation.getCurrentPosition(
        handleSuccess,
        (secondError) => {
          console.error('GPS acquisition error:', secondError);
          // Fallback with small variation near selected region center
          const randomLat = currentRegion.lat + (Math.random() - 0.5) * 0.01;
          const randomLon = currentRegion.lon + (Math.random() - 0.5) * 0.01;
          setCitizenCoords({
            lat: randomLat,
            lon: randomLon,
            accuracy: 120
          });
          setCitizenLocating(false);
          addSystemLog(
            lang === 'es'
              ? 'Error de GPS o denegado. Utilizando triangulación de celdas móviles.'
              : 'GPS error or denied. Using cell tower triangulation.',
            'warning'
          );
          if (voiceGuidance) {
            speakInstruction(
              lang === 'es'
                ? 'Error de señal satelital directa. Usando triangulación de red telefónica.'
                : 'Direct satellite signal failure. Using phone network triangulation.'
            );
          }
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      handleFailure,
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 60000 }
    );
  };

  // Auto Geolocate when Citizen View loads
  useEffect(() => {
    if (activeTab === 'citizen') {
      acquireCitizenLocation();
    }
  }, [activeTab]);

  // Citizen 1-Click SOS Broadcast
  const handleCitizenSOS = (type: EmergencyType, customDescOver?: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      addSystemLog(
        lang === 'es'
          ? 'Error de conexión con central satelital. Canal de respaldo analógico activo.'
          : 'Satellite connection failure. Backup analog channel active.',
        'danger'
      );
      if (voiceGuidance) {
        speakInstruction(
          lang === 'es'
            ? 'Fallo en la conexión satelital. Intentando enlace analógico de emergencia.'
            : 'Satellite link failed. Attempting emergency analog backup link.'
        );
      }
      return;
    }

    const lat = citizenCoords?.lat ?? currentRegion.lat;
    const lon = citizenCoords?.lon ?? currentRegion.lon;
    const accuracy = citizenCoords?.accuracy ?? 15;

    const reportId = `rep-SOS-${Date.now()}`;
    const signature = `sig-citizen-${type}-${Date.now()}`;

    // Gather all requested vehicles
    const requestedTypes: string[] = [];
    if (citizenRequestVehicles.fire_truck) requestedTypes.push(lang === 'es' ? 'Bomberos 🚒' : 'Fire Engine 🚒');
    if (citizenRequestVehicles.ambulance) requestedTypes.push(lang === 'es' ? 'Ambulancia 🚑' : 'Ambulance 🚑');
    if (citizenRequestVehicles.heavy_rescue) requestedTypes.push(lang === 'es' ? 'Rescate Pesado 🚛' : 'Heavy Rescue 🚛');
    if (citizenRequestVehicles.hazmat) requestedTypes.push(lang === 'es' ? 'Contención Hazmat ☣️' : 'Hazmat Cont. ☣️');

    // If none are selected, auto-select based on primary type
    if (requestedTypes.length === 0) {
      if (type === 'fire') requestedTypes.push(lang === 'es' ? 'Bomberos 🚒' : 'Fire Engine 🚒');
      if (type === 'medical') requestedTypes.push(lang === 'es' ? 'Ambulancia 🚑' : 'Ambulance 🚑');
      if (type === 'landslide') requestedTypes.push(lang === 'es' ? 'Rescate Pesado 🚛' : 'Heavy Rescue 🚛');
      if (type === 'chemical') requestedTypes.push(lang === 'es' ? 'Contención Hazmat ☣️' : 'Hazmat Cont. ☣️');
    }

    const reqStr = lang === 'es' 
      ? `Solicitud de Recursos: [${requestedTypes.join(', ')}]`
      : `Resources Requested: [${requestedTypes.join(', ')}]`;

    let desc = '';
    if (customDescOver) {
      desc = customDescOver;
    } else {
      const comment = citizenCustomComment.trim();
      if (!comment) {
        if (type === 'fire') {
          desc = lang === 'es'
            ? `🔥 SOS CIUDADANO DIRECTO: Incendio / Incendio Estructural. (${reqStr})`
            : `🔥 DIRECT CITIZEN SOS: Fire / Structural Fire. (${reqStr})`;
        } else if (type === 'chemical') {
          desc = lang === 'es'
            ? `☣️ SOS CIUDADANO DIRECTO: Fuga química o materiales nocivos. (${reqStr})`
            : `☣️ DIRECT CITIZEN SOS: Chemical leak or hazardous material spill. (${reqStr})`;
        } else if (type === 'medical') {
          desc = lang === 'es'
            ? `🩺 SOS CIUDADANO DIRECTO: Soporte médico / persona herida grave. (${reqStr})`
            : `🩺 DIRECT CITIZEN SOS: Medical support requested. (${reqStr})`;
        } else if (type === 'landslide') {
          desc = lang === 'es'
            ? `⚠️ SOS CIUDADANO DIRECTO: Derrumbe / Colapso de estructura. (${reqStr})`
            : `⚠️ DIRECT CITIZEN SOS: Landslide / structural collapse. (${reqStr})`;
        } else {
          desc = lang === 'es'
            ? `🚨 SOS CIUDADANO DIRECTO. (${reqStr})`
            : `🚨 DIRECT CITIZEN SOS. (${reqStr})`;
        }
      } else {
        desc = lang === 'es'
          ? `🚨 SOS CIUDADANO (${reqStr}) - Comentario: ${comment}`
          : `🚨 CITIZEN SOS (${reqStr}) - Comment: ${comment}`;
      }
    }

    const reqVehicles = {
      fire_truck: citizenRequestVehicles.fire_truck,
      ambulance: citizenRequestVehicles.ambulance,
      heavy_rescue: citizenRequestVehicles.heavy_rescue,
      hazmat: citizenRequestVehicles.hazmat
    };

    if (!reqVehicles.fire_truck && !reqVehicles.ambulance && !reqVehicles.heavy_rescue && !reqVehicles.hazmat) {
      if (type === 'fire') reqVehicles.fire_truck = true;
      if (type === 'medical') reqVehicles.ambulance = true;
      if (type === 'landslide') reqVehicles.heavy_rescue = true;
      if (type === 'chemical') reqVehicles.hazmat = true;
    }

    const reportData: EmergencyReport = {
      id: reportId,
      type,
      lat,
      lon,
      accuracy,
      timestamp: Date.now(),
      networkSignature: signature,
      status: 'pending',
      description: desc,
      isSimulation: false,
      requestedVehicles: reqVehicles
    };

    if ((user || bypassAuth) && activeTab !== 'drill') {
      const reportDocRef = doc(db, 'incidents', reportId);
      setDoc(reportDocRef, { ...reportData, reportedBy: user ? user.uid : 'bypass_citizen' }).catch(err => {
        console.error("Failed to write citizen report to Firestore:", err);
      });
    }

    socketRef.current.send(JSON.stringify({
      type: 'emergency_reported',
      payload: reportData,
      isSimulation: false
    }));

    setActiveCitizenReportId(reportId);
    setCitizenCustomComment('');
    setCitizenRequestVehicles({ fire_truck: false, ambulance: false, heavy_rescue: false, hazmat: false });
    triggerTacticalAlertSound();

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([300, 150, 300, 150, 400]);
      } catch (e) {}
    }

    let voiceMsg = '';
    if (type === 'fire') {
      voiceMsg = lang === 'es'
        ? 'Alerta de incendio transmitida con éxito. Ayuda en camino. Aléjese de fuentes térmicas y humos.'
        : 'Fire alert successfully transmitted. Help is on the way. Stay away from heat sources and smoke.';
    } else if (type === 'chemical') {
      voiceMsg = lang === 'es'
        ? 'Alerta de peligro químico transmitida. Busque terreno elevado en sentido opuesto al viento.'
        : 'Chemical hazard alert transmitted. Seek high ground upwind.';
    } else if (type === 'medical') {
      voiceMsg = lang === 'es'
        ? 'Alerta de emergencia médica registrada. Mantenga la calma, la ambulancia avanzada ha sido alertada.'
        : 'Medical emergency registered. Keep calm, advanced ambulance has been dispatched.';
    } else {
      voiceMsg = lang === 'es'
        ? 'Alerta de derrumbe transmitida. Aléjese de estructuras inestables de inmediato.'
        : 'Landslide alert transmitted. Stay away from unstable structures immediately.';
    }

    if (voiceGuidance) {
      speakInstruction(voiceMsg);
    }

    addSystemLog(
      lang === 'es'
        ? `🚨 SOS CIUDADANO TRANSMITIDO: Vector ${type.toUpperCase()} geolocalizado con precisión.`
        : `🚨 CITIZEN SOS TRANSMITTED: Vector ${type.toUpperCase()} precisely geolocated.`,
      'danger'
    );
  };

  // Safe Haversine helper for citizen proximity tracking
  const getHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Dispatch a unit to an emergency manual trigger override
  const handleDispatchUnit = (reportId: string, unitId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    if ((user || bypassAuth) && activeTab !== 'drill') {
      const reportDocRef = doc(db, 'incidents', reportId);
      setDoc(reportDocRef, { status: 'dispatched', assignedUnitId: unitId }, { merge: true }).catch(err => {
        console.error("Failed to update Firestore incident status:", err);
      });
    }

    socketRef.current.send(JSON.stringify({
      type: 'unit_dispatched',
      payload: { reportId, unitId },
      isSimulation: activeTab === 'drill'
    }));
  };

  // Handle Copilot tablet route blocked alert
  const handleTriggerRouteBlocked = (unitId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({
      type: 'unit_route_blocked',
      payload: { unitId },
      isSimulation: activeTab === 'drill'
    }));
    
    addSystemLog(`⚠️ Unidad ${unitId} reportó bloqueo en ruta. Recalculando matriz de despacho en < 50 ms.`, 'warning');
  };

  // Update telemetry manual override slider for Drill mode
  const handleUpdateTelemetry = (unitId: string, telemetry: Partial<FleetUnit>) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({
      type: 'unit_telemetry',
      payload: { id: unitId, ...telemetry },
      isSimulation: activeTab === 'drill'
    }));
  };

  // Trigger one-click optimal route return to base
  const handleReturnToBase = (unitId: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({
      type: 'unit_return_home',
      payload: { unitId },
      isSimulation: activeTab === 'drill'
    }));
  };

  // Run predictive Stress test simulation
  const handleRunStressTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setSimResult(null);

    try {
      const res = await fetch('/api/simulation/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(simConfig)
      });
      const data = await res.json();
      setSimResult(data);
    } catch (err) {
      console.error('Failed to run simulation test:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Start Training Drill
  const handleStartDrill = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({
      type: 'drill_started',
      payload: {
        name: drillName,
        username: traineeName,
        duration: drillDuration
      }
    }));
  };

  // Stop Training Drill
  const handleStopDrill = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

    socketRef.current.send(JSON.stringify({
      type: 'drill_stopped',
      payload: {}
    }));
  };

  // Reset System State
  const handleResetSystem = async () => {
    const confirmMsg = lang === 'es'
      ? '¿Confirmar reinicio absoluto de telemetría y misiones?'
      : 'Confirm absolute reset of telemetry and missions?';
    if (confirm(confirmMsg)) {
      try {
        await fetch('/api/system/reset', { method: 'POST' });
        setSelectedReportId(undefined);
        setSelectedUnitId(undefined);
        setActiveDms(new Map());
        addSystemLog(
          lang === 'es'
            ? 'Sistema restablecido a parámetros base de operación.'
            : 'System reset to base operational parameters.',
          'info'
        );
      } catch (err) {
        console.error('Reset failed:', err);
      }
    }
  };

  // Active state selectors based on active mode
  const currentSectors = activeTab === 'drill' ? drillSectors : sectors;
  const currentUnits = activeTab === 'drill' ? drillUnits : units;
  const currentReports = activeTab === 'drill' ? drillReports : reports;

  return (
    <div className={`flex flex-col h-screen bg-[#050505] text-[#00FF41] font-mono text-xs select-none border-4 border-[#1a1a1a] tech-dot-grid ${highContrast ? 'high-contrast-mode' : ''} ${appTheme === 'light' ? 'theme-light' : ''}`}>
      
      {/* 1. MAIN MISSION CONTROL HUD HEADER */}
      <header className="bg-[#0a0a0a] border-b border-[#00FF41]/30 p-4 flex flex-wrap gap-4 items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-[#00FF41] animate-pulse rounded-full"></div>
          <div>
            <h1 className="text-sm font-black tracking-widest text-[#00FF41] uppercase">
              {lang === 'es'
                ? 'SOAE v4.2 // SISTEMA DE ORQUESTACIÓN AUTÓNOMA'
                : 'SOAE v4.2 // AUTONOMOUS ORCHESTRATION SYSTEM'}
            </h1>
            <div className="flex items-center gap-3 text-[10px] text-[#00FF41]/60 mt-0.5">
              <span>
                {lang === 'es'
                  ? 'NÚCLEO ESTABLE // OFFLINE-FIRST ACTIVE'
                  : 'STABLE KERNEL // OFFLINE-FIRST ACTIVE'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-[#00FF41] animate-pulse' : 'bg-[#FF4444] animate-ping'}`} />
                {socketConnected
                  ? (lang === 'es' ? 'CONEXIÓN: SATELITAL EN LÍNEA' : 'CONNECTION: SATELLITE ONLINE')
                  : (lang === 'es' ? 'CONEXIÓN: DEGRADADA' : 'CONNECTION: DEGRADED')}
              </span>
            </div>
          </div>
        </div>

        {/* Global Control Center actions */}
        <div className="flex items-center gap-3">
          {user && !user.isAnonymous && (
            <div className="flex items-center gap-2 bg-[#050505] px-3 py-1.5 border border-[#00FF41]/20 text-xxs font-black text-[#00FF41]">
              <span className="w-1.5 h-1.5 bg-[#00FF41] rounded-full animate-ping" />
              <span className="truncate max-w-[120px]">{user.email}</span>
              <button
                onClick={() => signOut(firebaseAuth)}
                className="ml-2 hover:text-[#FF4444] border border-[#00FF41]/30 hover:border-[#FF4444] px-1 py-0.5 uppercase transition-colors text-[8px] cursor-pointer"
              >
                [{lang === 'es' ? 'SALIR' : 'EXIT'}]
              </button>
            </div>
          )}

          {bypassAuth && !user && (
            <div className="flex items-center gap-2 bg-[#00FF41]/10 px-3 py-1.5 border border-[#00FF41]/40 text-xxs font-black text-[#00FF41]">
              <span className="w-1.5 h-1.5 bg-[#00FF41] rounded-full animate-pulse" />
              <span>{lang === 'es' ? 'MODO SANDBOX' : 'SANDBOX MODE'}</span>
              <button
                onClick={() => {
                  setBypassAuth(false);
                  localStorage.removeItem('soae_bypass_auth');
                }}
                className="ml-2 hover:text-[#FF4444] border border-[#00FF41]/30 hover:border-[#FF4444] px-1 py-0.5 uppercase transition-colors text-[8px] cursor-pointer bg-black/50"
              >
                [{lang === 'es' ? 'BLOQUEAR' : 'LOCK'}]
              </button>
            </div>
          )}

          <div className="hidden md:flex bg-[#050505] px-3 py-1.5 border border-[#00FF41]/20 flex items-center gap-2 text-xxs font-black">
            <Clock className="w-3.5 h-3.5 text-[#00FF41]" />
            <span>{lang === 'es' ? 'UTC LOCAL' : 'LOCAL UTC'}: {new Date().toLocaleTimeString()}</span>
          </div>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="px-4 py-1.5 bg-[#00FF41]/10 hover:bg-[#00FF41] hover:text-black text-[#00FF41] border border-[#00FF41] font-black tracking-wider transition-all flex items-center gap-2 cursor-pointer rounded-none text-xxs shadow-[0_0_10px_rgba(0,255,65,0.1)]"
            title={lang === 'es' ? 'Abrir configuración de sistema' : 'Open system configuration'}
          >
            <Settings className="w-3.5 h-3.5 animate-spin-slow" />
            {lang === 'es' ? 'CONFIGURACIÓN' : 'SETTINGS'}
          </button>
        </div>
      </header>

      {/* 2. LIVE TELEMETRY WARN STREAM BANNER */}
      {systemAlerts.length > 0 && (
        <div className="bg-[#0a0a0a]/90 border-b border-[#00FF41]/30 px-4 py-2 flex items-center gap-3 overflow-hidden text-xxs select-none shrink-0">
          <Radio className="w-4 h-4 text-[#00FF41] animate-pulse flex-shrink-0" />
          <div className="flex gap-6 animate-marquee whitespace-nowrap text-[#00FF41]/80">
            {systemAlerts.map((log) => (
              <span key={log.id} className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${log.type === 'danger' ? 'bg-[#FF4444]' : log.type === 'warning' ? 'bg-[#FFD700]' : 'bg-[#00FF41]'}`} />
                <span className="uppercase">{log.msg}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. MULTI-INTERFACE TAB SELECTOR */}
      <div className="bg-[#0a0a0a]/90 border-b border-[#00FF41]/20 p-2 flex gap-1 z-40 shrink-0">
        <button
          onClick={() => { setActiveTab('ops'); setSelectedReportId(undefined); }}
          className={`px-4 py-2 font-bold uppercase tracking-wider text-xxs transition-all flex items-center gap-2 border rounded-none cursor-pointer ${
            activeTab === 'ops'
              ? 'bg-[#00FF41]/10 border-[#00FF41] text-white shadow-[0_0_10px_rgba(0,255,65,0.15)]'
              : 'border-transparent text-[#00FF41]/60 hover:bg-[#00FF41]/5 hover:text-[#00FF41]'
          }`}
        >
          <Activity className="w-4 h-4 text-[#00FF41]" />
          {lang === 'es' ? 'Mando Central (Radar Real)' : 'Command Center (Real Radar)'}
        </button>

        <button
          onClick={() => { setActiveTab('dashboard'); setSelectedReportId(undefined); }}
          className={`px-4 py-2 font-bold uppercase tracking-wider text-xxs transition-all flex items-center gap-2 border rounded-none cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#00FF41]/10 border-[#00FF41] text-white shadow-[0_0_10px_rgba(0,255,65,0.15)]'
              : 'border-transparent text-[#00FF41]/60 hover:bg-[#00FF41]/5 hover:text-[#00FF41]'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-[#00FF41]" />
          {lang === 'es' ? 'Métricas Globales (KPIs)' : 'Global Metrics (KPIs)'}
        </button>

        <button
          onClick={() => { setActiveTab('decisions'); setSelectedReportId(undefined); }}
          className={`px-4 py-2 font-bold uppercase tracking-wider text-xxs transition-all flex items-center gap-2 border rounded-none cursor-pointer ${
            activeTab === 'decisions'
              ? 'bg-[#00FF41]/10 border-[#00FF41] text-white shadow-[0_0_10px_rgba(0,255,65,0.15)]'
              : 'border-transparent text-[#00FF41]/60 hover:bg-[#00FF41]/5 hover:text-[#00FF41]'
          }`}
        >
          <Cpu className="w-4 h-4 text-[#00FF41]" />
          {lang === 'es' ? 'Bitácora Autónoma (SOAE)' : 'SOAE Decision Log'}
        </button>

        <button
          onClick={() => { setActiveTab('tablet'); setSelectedReportId(undefined); }}
          className={`px-4 py-2 font-bold uppercase tracking-wider text-xxs transition-all flex items-center gap-2 border rounded-none cursor-pointer ${
            activeTab === 'tablet'
              ? 'bg-[#00FF41]/10 border-[#00FF41] text-white shadow-[0_0_10px_rgba(0,255,65,0.15)]'
              : 'border-transparent text-[#00FF41]/60 hover:bg-[#00FF41]/5 hover:text-[#00FF41]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#00FF41]" />
          {lang === 'es' ? 'Tablet Copiloto Camión' : 'Truck Copilot Tablet'}
        </button>

        <button
          onClick={() => { setActiveTab('sim'); setSelectedReportId(undefined); }}
          className={`px-4 py-2 font-bold uppercase tracking-wider text-xxs transition-all flex items-center gap-2 border rounded-none cursor-pointer ${
            activeTab === 'sim'
              ? 'bg-[#00FF41]/10 border-[#00FF41] text-white shadow-[0_0_10px_rgba(0,255,65,0.15)]'
              : 'border-transparent text-[#00FF41]/60 hover:bg-[#00FF41]/5 hover:text-[#00FF41]'
          }`}
        >
          <Gauge className="w-4 h-4 text-[#FFD700]" />
          {lang === 'es' ? 'Gemelo Digital Stress-Test' : 'Digital Twin Stress-Test'}
        </button>

        <button
          onClick={() => { setActiveTab('drill'); setSelectedReportId(undefined); }}
          className={`px-4 py-2 font-bold uppercase tracking-wider text-xxs transition-all flex items-center gap-2 border rounded-none cursor-pointer ${
            activeTab === 'drill'
              ? 'bg-[#FF4444]/10 border-[#FF4444] text-[#FF4444] shadow-[0_0_10px_rgba(255,68,68,0.15)]'
              : 'border-transparent text-[#00FF41]/60 hover:bg-[#00FF41]/5 hover:text-[#00FF41]'
          }`}
        >
          <Award className="w-4 h-4 text-[#FF4444] animate-pulse" />
          {lang === 'es' ? 'Entrenamiento (Sandbox Drill)' : 'Training (Sandbox Drill)'}
        </button>

        <button
          onClick={() => { setActiveTab('citizen'); setSelectedReportId(undefined); }}
          className={`px-4 py-2 font-bold uppercase tracking-wider text-xxs transition-all flex items-center gap-2 border rounded-none cursor-pointer ${
            activeTab === 'citizen'
              ? 'bg-[#FF3333]/15 border-[#FF3333] text-[#FF3333] shadow-[0_0_12px_rgba(255,51,51,0.25)]'
              : 'border-transparent text-[#00FF41]/60 hover:bg-[#FF3333]/5 hover:text-[#FF3333]/80'
          }`}
        >
          <Radio className="w-4 h-4 text-[#FF3333] animate-pulse" />
          {lang === 'es' ? '[ Portal Ciudadano (SOS) ]' : '[ Citizen Portal (SOS) ]'}
        </button>
      </div>

      {/* 4. WORKSPACE DIVISION CONTAINER */}
      <div className="flex-1 overflow-hidden bg-[#020202]">
        
        {(!user || user.isAnonymous) && !bypassAuth && activeTab !== 'citizen' ? (
          <div className="h-full w-full flex items-center justify-center p-6 bg-black tech-dot-grid overflow-y-auto">
            <div className="w-full max-w-md border-2 border-[#00FF41]/40 bg-[#080808] p-6 shadow-[0_0_30px_rgba(0,255,65,0.15)] relative">
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#00FF41]/80"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-[#00FF41]/80"></div>
              
              <div className="flex items-center gap-2 border-b border-[#00FF41]/30 pb-3 mb-4">
                <Shield className="w-5 h-5 text-[#00FF41] animate-pulse" />
                <h2 className="text-xs font-black uppercase tracking-widest text-[#00FF41]">
                  {lang === 'es' ? 'ACCESO OFICIAL / MANDO CENTRAL' : 'OFFICIAL ACCESS / COMMAND GATEWAY'}
                </h2>
              </div>

              <p className="text-[#00FF41]/70 mb-4 text-xxs leading-relaxed uppercase">
                {lang === 'es' 
                  ? 'SE REQUIERE AUTENTICACIÓN OFICIAL ACTIVA PARA INTERACTUAR CON LA CENTRAL DE INCIDENTES CIVILES Y RECURSOS.'
                  : 'ACTIVE OFFICER AUTHENTICATION REQUIRED TO MONITOR AND ORCHESTRATE CIVILIAN EMERGENCIES.'}
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setAuthError('');
                  
                  // Local integrity check for password strength before sending request to Firebase auth
                  if (authPassword.length < 6) {
                    setAuthError(
                      lang === 'es'
                        ? 'La contraseña debe tener al menos 6 caracteres (Requisito de Seguridad).'
                        : 'The password must be at least 6 characters long (Security Requirement).'
                    );
                    return;
                  }

                  setAuthLoading(true);
                  try {
                    if (authIsRegister) {
                      await createUserWithEmailAndPassword(firebaseAuth, authEmail, authPassword);
                    } else {
                      await signInWithEmailAndPassword(firebaseAuth, authEmail, authPassword);
                    }
                  } catch (err: any) {
                    console.error(err);
                    const code = err?.code || '';
                    if (code === 'auth/operation-not-allowed') {
                      setAuthError(
                        lang === 'es' 
                          ? 'El método de autenticación por Correo/Contraseña no está habilitado en la consola de Firebase. Por favor, actívalo en Authentication -> Sign-in method.'
                          : 'Email/Password provider is not enabled in the Firebase Console. Please enable it under Authentication -> Sign-in method.'
                      );
                    } else if (code === 'auth/weak-password') {
                      setAuthError(
                        lang === 'es'
                          ? 'La contraseña elegida es demasiado débil (debe tener al menos 6 caracteres).'
                          : 'The chosen password is too weak (must be at least 6 characters).'
                      );
                    } else if (code === 'auth/email-already-in-use') {
                      setAuthError(
                        lang === 'es'
                          ? 'Este correo de operador ya se encuentra registrado en el sistema.'
                          : 'This operator email is already registered in the system.'
                      );
                    } else if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
                      setAuthError(
                        lang === 'es'
                          ? 'Credenciales de operador no válidas o incorrectas.'
                          : 'Invalid operator credentials or incorrect password.'
                      );
                    } else {
                      setAuthError(err.message || 'Authentication failed');
                    }
                  } finally {
                    setAuthLoading(false);
                  }
                }}
                className="flex flex-col gap-3"
              >
                {authError && (
                  <div className="bg-[#FF4444]/10 border border-[#FF4444] text-[#FF4444] p-2.5 text-xxs uppercase font-bold">
                    [ERROR]: {authError}
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-[#00FF41]/70 block mb-1 uppercase font-black">// CORREO DE OPERADOR:</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="officer@soae.gov"
                    className="w-full bg-black text-[#00FF41] border border-[#00FF41]/40 px-3 py-1.5 text-xs focus:outline-none focus:border-[#00FF41] font-mono rounded-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#00FF41]/70 block mb-1 uppercase font-black">// CLAVE DE ACCESO:</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black text-[#00FF41] border border-[#00FF41]/40 px-3 py-1.5 text-xs focus:outline-none focus:border-[#00FF41] font-mono rounded-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-2 py-2.5 bg-[#00FF41]/15 border-2 border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41] hover:text-black font-black transition-all rounded-none uppercase cursor-pointer text-xs"
                >
                  {authLoading 
                    ? (lang === 'es' ? 'AUTORIZANDO CREDENCIALES...' : 'AUTHORIZING CREDENTIALS...')
                    : authIsRegister 
                      ? (lang === 'es' ? '[ REGISTRAR NUEVO OPERADOR ]' : '[ REGISTER NEW OPERATOR ]')
                      : (lang === 'es' ? '[ INICIAR SESIÓN DE MANDO ]' : '[ LOG IN TO COMMAND CONTROL ]')}
                </button>
              </form>

              <div className="mt-4 text-center border-t border-[#00FF41]/10 pt-3 flex flex-col gap-2">
                <button
                  onClick={() => setAuthIsRegister(!authIsRegister)}
                  className="text-[#00FF41]/60 hover:text-[#00FF41] transition-colors text-xxs uppercase cursor-pointer underline"
                >
                  {authIsRegister 
                    ? (lang === 'es' ? '¿Ya tienes placa oficial? Iniciar sesión' : 'Have a badge? Sign In')
                    : (lang === 'es' ? '¿Nuevo operador? Registrar placa aquí' : 'New operator? Register badge here')}
                </button>

                <div className="border-t border-[#00FF41]/15 my-2 pt-3">
                  <button
                    onClick={() => {
                      setBypassAuth(true);
                      localStorage.setItem('soae_bypass_auth', 'true');
                      addSystemLog(
                        lang === 'es'
                          ? 'SISTEMA: Acceso de estudiante/evaluador concedido mediante bypass de Sandbox.'
                          : 'SYSTEM: Student/evaluator access granted via Sandbox bypass.',
                        'info'
                      );
                    }}
                    className="w-full py-2 bg-[#FFD700]/10 border border-[#FFD700] hover:bg-[#FFD700] hover:text-black text-[#FFD700] text-xxs font-black uppercase tracking-widest transition-all cursor-pointer rounded-none"
                  >
                    {lang === 'es' 
                      ? '⚠️ [ ACCEDER EN MODO EVALUACIÓN / SANDBOX ]' 
                      : '⚠️ [ ACCESS IN EVALUATION / SANDBOX MODE ]'}
                  </button>
                  <p className="text-[9px] text-[#FFD700]/60 mt-1 uppercase leading-normal">
                    {lang === 'es'
                      ? '* No requiere contraseña ni configuración de Firebase.'
                      : '* Does not require passwords or Firebase auth setup.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ==========================================
                TAB 1 & 4: COMMAND CONTROLS & DRILL CORE
                ========================================== */}
            {(activeTab === 'ops' || activeTab === 'drill') && (
              <div className="h-full grid grid-cols-1 xl:grid-cols-12 gap-4 p-4 overflow-y-auto xl:overflow-hidden">
            
            {/* LEFT HUD: RISK CONSOLES & ACTIVE LOGS (4 Cols) */}
            <div className="xl:col-span-4 flex flex-col gap-4 xl:overflow-y-auto">
              
              {/* IF IN DRILL MODE: TRAINING DRILL MONITOR BOARD */}
              {activeTab === 'drill' && (
                <div className="bg-[#0a0a0a] border-2 border-[#FF4444]/40 p-4 flex flex-col gap-3 rounded-none">
                  <div className="flex justify-between items-center border-b border-[#FF4444]/20 pb-2.5">
                    <span className="text-[#FF4444] font-black uppercase tracking-widest text-xs">
                      {lang === 'es' ? 'CENTRO DE SIMULACROS // DRILL_CORE' : 'DRILL CENTER // DRILL_CORE'}
                    </span>
                    <span className="text-[#FF4444]/60 text-[9px] uppercase">
                      {lang === 'es' ? 'COOPERATIVO 1:1' : '1:1 COOPERATIVE'}
                    </span>
                  </div>

                  {!drillSession?.isActive ? (
                    <div className="flex flex-col gap-3 text-xs">
                      <div>
                        <label className="text-[10px] text-[#FF4444]/70 block mb-1 uppercase font-bold">
                          {lang === 'es' ? '// NOMBRE EJERCICIO:' : '// EXERCISE NAME:'}
                        </label>
                        <input
                          type="text"
                          value={drillName}
                          onChange={(e) => setDrillName(e.target.value)}
                          className="w-full bg-black text-[#FF4444] border border-[#FF4444]/40 px-3 py-1.5 focus:outline-none focus:border-[#FF4444] font-bold rounded-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#FF4444]/70 block mb-1 uppercase font-bold">
                            {lang === 'es' ? '// OPERADOR:' : '// OPERATOR:'}
                          </label>
                          <input
                            type="text"
                            value={traineeName}
                            onChange={(e) => setTraineeName(e.target.value)}
                            className="w-full bg-black text-[#FF4444] border border-[#FF4444]/40 px-3 py-1.5 focus:outline-none focus:border-[#FF4444] rounded-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#FF4444]/70 block mb-1 uppercase font-bold">
                            {lang === 'es' ? '// DURACIÓN (S):' : '// DURATION (S):'}
                          </label>
                          <input
                            type="number"
                            value={drillDuration}
                            onChange={(e) => setDrillDuration(Number(e.target.value))}
                            className="w-full bg-black text-[#FF4444] border border-[#FF4444]/40 px-3 py-1.5 focus:outline-none focus:border-[#FF4444] rounded-none font-bold"
                          />
                        </div>
                      </div>
                      <button
                        onClick={handleStartDrill}
                        className="w-full py-2.5 bg-[#FF4444] text-black font-black border-2 border-[#FF4444] hover:bg-transparent hover:text-[#FF4444] transition-colors rounded-none shadow cursor-pointer uppercase text-xs"
                      >
                        {lang === 'es' ? '[ EJECUTAR SIMULACRO NACIONAL ]' : '[ EXECUTE NATIONAL DRILL ]'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center bg-[#FF4444]/10 p-3 border border-[#FF4444]/30">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 bg-[#FF4444] rounded-full animate-ping" />
                          <div>
                            <span className="text-[#FF4444] font-black text-xs uppercase block">{drillSession.name}</span>
                            <span className="text-[10px] text-[#FF4444]/70 block">
                              {lang === 'es' ? `ALUMNO: ${traineeName}` : `TRAINEE: ${traineeName}`}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-[#FF4444]/60 block uppercase font-bold">
                            {lang === 'es' ? 'CRONÓMETRO' : 'STOPWATCH'}
                          </span>
                          <span className="text-sm font-black text-[#FF4444]">{drillSession.elapsedSeconds}s / {drillSession.duration}s</span>
                        </div>
                      </div>

                      <div className="bg-black p-2 border border-[#FF4444]/20 text-xxs leading-relaxed text-[#FF4444]">
                        <span className="text-[#FF4444]/80 font-bold block mb-1 uppercase">// COOPERATIVE_EVENTS_QUEUE:</span>
                        <div className="flex flex-col gap-1.5">
                          {drillSession.injectedEvents.map(ev => (
                            <div key={ev.id} className="flex justify-between items-center bg-[#FF4444]/5 p-1.5 border border-[#FF4444]/10">
                              <span>T+{ev.delaySeconds}s: {ev.report.description?.slice(13, 35)}...</span>
                              <span className={`px-1.5 border font-bold text-[9px] ${ev.isTriggered ? 'bg-[#FF4444]/20 text-[#FF4444] border-[#FF4444]/40' : 'bg-black text-[#FF4444]/40 border-[#FF4444]/10'}`}>
                                {ev.isTriggered ? (lang === 'es' ? 'TRANSMITIDO' : 'TRANSMITTED') : (lang === 'es' ? 'COLA' : 'QUEUE')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleStopDrill}
                        className="w-full py-2.5 bg-black hover:bg-[#FF4444]/10 text-[#FF4444] font-black border-2 border-[#FF4444]/50 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase text-xs rounded-none"
                      >
                        <Square className="w-4 h-4 text-[#FF4444] fill-[#FF4444]" />
                        {lang === 'es' ? '[ ABORTAR SIMULACRO - EVALUAR ]' : '[ ABORT DRILL - EVALUATE ]'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* COVERAGE SECTORS LIST (Dynamic IVR Readouts) */}
              <div className="bg-[#0a0a0a] border border-[#00FF41]/30 p-4 flex flex-col gap-3 rounded-none">
                <span className="font-bold text-white border-b border-[#00FF41]/20 pb-2 uppercase tracking-wider flex justify-between items-center">
                  <span className="flex items-center gap-1.5">
                    {lang === 'es' ? 'Índice de Vulnerabilidad Residual (IVR)' : 'Residual Vulnerability Index (RVI)'}
                    <button
                      onClick={() => setShowRviHelp(!showRviHelp)}
                      className="p-0.5 hover:bg-[#00FF41]/10 text-[#00FF41]/60 hover:text-[#00FF41] transition-colors rounded cursor-pointer"
                      title={lang === 'es' ? 'Explicación del IVR' : 'Explanation of RVI'}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </span>
                  <span className="text-[10px] text-slate-500">{lang === 'es' ? 'MUNICIPAL' : 'MUNICIPAL'}</span>
                </span>

                {showRviHelp && (
                  <div className="bg-[#00FF41]/5 border border-[#00FF41]/40 p-2.5 text-[10px] text-[#00FF41]/90 font-mono leading-relaxed relative">
                    <button
                      onClick={() => setShowRviHelp(false)}
                      className="absolute top-1 right-2 text-white hover:text-[#FF4444] font-bold text-xxs cursor-pointer"
                    >
                      [x]
                    </button>
                    <p className="font-bold border-b border-[#00FF41]/20 pb-1 mb-1.5 uppercase text-[#00FF41]">
                      {lang === 'es' ? 'ℹ️ ¿Qué es el IVR?' : 'ℹ️ What is the RVI?'}
                    </p>
                    <p>
                      {lang === 'es'
                        ? 'El Índice de Vulnerabilidad Residual (IVR) calcula en tiempo real el nivel de desprotección de un sector. Considera la densidad poblacional, el riesgo base de la zona, y la distancia o ETA de las unidades de rescate más cercanas. Un IVR > 85% indica cobertura crítica.'
                        : 'The Residual Vulnerability Index (RVI) computes real-time sector desolation by combining population density, base sector risk, and the travel time/ETA of nearby available response units. RVI > 85% denotes critical coverage deficits.'}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2.5">
                  {currentSectors.map((sec) => {
                    let colorClass = 'text-emerald-400';
                    let barColor = 'bg-emerald-500';
                    if (sec.ivr > 0.85) { colorClass = 'text-red-500 font-bold'; barColor = 'bg-red-500 animate-pulse'; }
                    else if (sec.ivr > 0.65) { colorClass = 'text-orange-400'; barColor = 'bg-orange-400'; }
                    else if (sec.ivr > 0.4) { colorClass = 'text-amber-500'; barColor = 'bg-amber-500'; }

                    return (
                      <div
                        key={sec.id}
                        onDoubleClick={() => {
                          setFocusedLocation({
                            lat: sec.center[0],
                            lon: sec.center[1],
                            timestamp: Date.now()
                          });
                          addSystemLog(
                            lang === 'es'
                              ? `NAVEGACIÓN: Enfocando minimapa en sector táctico ${sec.name}`
                              : `NAVIGATION: Focusing minimap on tactical sector ${sec.name}`,
                            'info'
                          );
                        }}
                        title={lang === 'es' ? 'Doble clic para enfocar en mapa' : 'Double click to focus on map'}
                        className="bg-slate-950 p-2.5 rounded border border-slate-850 hover:border-[#00FF41]/40 transition-all flex flex-col gap-1.5 cursor-pointer select-none active:scale-[0.98]"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-slate-300 font-bold">{sec.name}</span>
                          <span className={`${colorClass}`}>{(sec.ivr * 100).toFixed(1)}% IVR</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${sec.ivr * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* MIDDLE SECTION: COMMAND RADAR DISPLAY MAP (5 Cols) */}
            <div className="xl:col-span-5 h-[350px] xl:h-full flex flex-col">
              <CommandMap
                sectors={currentSectors}
                units={currentUnits}
                reports={currentReports}
                selectedUnitId={selectedUnitId}
                selectedReportId={selectedReportId}
                onSelectUnit={(id) => setSelectedUnitId(id)}
                onSelectReport={(id) => setSelectedReportId(id)}
                isSimulation={activeTab === 'drill'}
                lang={lang}
                blockages={activeTab === 'drill' ? drillBlockages : opsBlockages}
                focusedLocation={focusedLocation}
                onAddBaseStation={handleMapAddBaseStation}
                onAddIncident={handleMapAddIncident}
              />
            </div>

            {/* RIGHT SIDEBAR: INCIDENT QUEUE, OPTIMIZATION DESPATCH, DRILL REPORT CHART (3 Cols) */}
            <div className="xl:col-span-3 flex flex-col gap-4 xl:overflow-y-auto">
              
              {/* TRAINING DRILL EVALUATION CARD (Displays if complete and in Drill) */}
              {activeTab === 'drill' && drillPerformance && (
                <div className="bg-[#00FF41]/10 border-2 border-[#00FF41]/40 p-4 flex flex-col gap-3 rounded-none shadow-[0_0_10px_rgba(0,255,65,0.1)]">
                  <div className="flex items-center gap-2 border-b border-[#00FF41]/30 pb-2.5">
                    <Award className="w-5 h-5 text-[#00FF41] animate-bounce" />
                    <span className="text-[#00FF41] font-black uppercase tracking-widest text-xs">REPORTE EVALUADOR DRILL</span>
                  </div>

                  <div className="text-center py-2">
                    <span className="text-[10px] text-[#00FF41]/60 uppercase block">PUNTUACIÓN OBTENIDA</span>
                    <span className="text-3xl font-black text-white">{drillPerformance.score} / 100</span>
                    <span className="text-[10px] text-[#00FF41] block font-bold mt-2 uppercase tracking-widest bg-[#00FF41]/10 border border-[#00FF41]/30 py-1 px-3 max-w-[140px] mx-auto rounded-none">
                      {drillPerformance.rank}
                    </span>
                  </div>

                  <div className="bg-black p-2.5 border border-[#00FF41]/20 flex flex-col gap-2 text-xxs text-[#00FF41]/80">
                    <div className="flex justify-between">
                      <span className="text-[#00FF41]/60 font-bold uppercase">Promedio Respuesta:</span>
                      <span className="text-white font-bold">{drillPerformance.averageResponseTimeSec} seg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#00FF41]/60 font-bold uppercase">Rutas Sorteados:</span>
                      <span className="text-white font-bold">{drillPerformance.routeBlockBypasses} exitosos</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#00FF41]/60 font-bold uppercase">Evitaciones de Spikes:</span>
                      <span className="text-white font-bold">{drillPerformance.ivrSpikesPrevented} preventivas</span>
                    </div>
                  </div>
                </div>
              )}

              {/* UNRESOLVED EMERGENCY REPORTS LIST */}
              <div className="bg-[#0a0a0a] border border-[#00FF41]/30 p-4 flex flex-col gap-3 rounded-none">
                <span className="font-bold text-white border-b border-[#00FF41]/20 pb-2 uppercase tracking-wider text-xs flex justify-between items-center">
                  <span>
                    {lang === 'es' ? 'Incidentes Activos // LIST_REPORTS' : 'Active Incidents // LIST_REPORTS'}
                  </span>
                  <button
                    onClick={() => setShowDmsHelp(!showDmsHelp)}
                    className="p-0.5 hover:bg-[#00FF41]/10 text-[#00FF41]/60 hover:text-[#00FF41] transition-colors rounded cursor-pointer"
                    title={lang === 'es' ? 'Explicación del temporizador de seguridad (DMS)' : 'Explanation of safety timer (DMS)'}
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </span>

                {showDmsHelp && (
                  <div className="bg-[#00FF41]/5 border border-[#FF4444]/40 p-2.5 text-[10px] text-[#00FF41]/90 font-mono leading-relaxed relative">
                    <button
                      onClick={() => setShowDmsHelp(false)}
                      className="absolute top-1 right-2 text-white hover:text-[#FF4444] font-bold text-xxs cursor-pointer"
                    >
                      [x]
                    </button>
                    <p className="font-bold border-b border-[#FF4444]/20 pb-1 mb-1.5 uppercase text-[#FF4444]">
                      {lang === 'es' ? 'ℹ️ Dead-man\'s Switch (DMS)' : 'ℹ️ Dead-man\'s Switch (DMS)'}
                    </p>
                    <p>
                      {lang === 'es'
                        ? 'Al recibir una alerta ciudadana, se activa un temporizador de seguridad de 60 segundos. Si el despachador humano no reacciona a tiempo, el núcleo autónomo satelital SOAE despacha automáticamente la unidad más óptima para salvaguardar vidas.'
                        : 'Upon receiving a citizen alert, a 60-second safety timer is activated. If the human dispatcher fails to act in time, the SOAE satellite core automatically dispatches the optimal response unit to secure lives.'}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto">
                  {currentReports.filter(r => r.status !== 'resolved').length === 0 ? (
                    <div className="text-xxs text-[#00FF41]/40 text-center py-4 uppercase">
                      No hay incidentes reportados.
                    </div>
                  ) : (
                    currentReports.filter(r => r.status !== 'resolved').map((rep) => {
                      const isSelected = selectedReportId === rep.id;
                      const hasDms = activeDms.has(rep.id);
                      const dmsTimeLeft = activeDms.get(rep.id) ?? 60;

                      let badgeColor = 'bg-[#FF4444]/10 text-[#FF4444] border-[#FF4444]/40';
                      if (rep.status === 'dispatched') badgeColor = 'bg-[#00FF41]/10 text-[#00FF41] border-[#00FF41]/40';

                      return (
                        <div
                          key={rep.id}
                          onClick={() => setSelectedReportId(rep.id)}
                          className={`p-2.5 border cursor-pointer transition-all rounded-none ${
                            isSelected ? 'bg-[#00FF41]/10 border-[#00FF41] shadow-[0_0_8px_rgba(0,255,65,0.1)]' : 'bg-black border-[#00FF41]/10 hover:border-[#00FF41]/30'
                          }`}
                        >
                          <div className="flex justify-between items-center text-[10px] mb-1">
                            <span className="font-bold uppercase text-white">{rep.type}</span>
                            <span className={`px-1.5 border text-[9px] font-bold ${badgeColor}`}>
                              {rep.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[#00FF41]/60 text-xxs line-clamp-1 mb-1 font-mono">{rep.description}</p>
                          
                          {/* Dead-man's switch visual timer */}
                          {hasDms && rep.status === 'pending' && (
                            <div className="mt-1.5 bg-[#FF4444]/10 border border-[#FF4444]/40 px-2 py-1 flex justify-between items-center text-[9px] text-[#FF4444] animate-pulse">
                              <span className="font-bold">[ DEAD-MAN'S SWITCH ]</span>
                              <span className="font-black text-xs">{dmsTimeLeft}s</span>
                            </div>
                          )}

                          {rep.status === 'pending' && !isSelected && (
                            <div className="mt-2 text-center text-[9px] bg-[#00FF41]/10 text-[#00FF41] border border-[#00FF41]/30 py-1 font-black animate-pulse uppercase">
                              {lang === 'es' ? '▶ CLICK PARA SELECCIONAR Y DESPACHAR' : '▶ CLICK TO SELECT & DISPATCH'}
                            </div>
                          )}

                          {isSelected && (
                            <div className="mt-2 text-center text-[9px] bg-white/10 text-white border border-white/20 py-1 font-black uppercase">
                              {lang === 'es' ? '● ANALIZANDO ASIGNACIÓN EN TIEMPO REAL' : '● ANALYZING ASSIGNMENT IN REAL-TIME'}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* DIRECTED OPTIMIZATION MATCH DECISION ASSISTANT CARD */}
              {!selectedReportId && (
                <div className="bg-[#0a0a0a]/50 border border-[#00FF41]/10 p-4 flex flex-col items-center justify-center text-center gap-3 rounded-none min-h-[140px] border-dashed">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
                  <span className="font-bold text-yellow-500 text-xxs uppercase tracking-widest">
                    {lang === 'es' 
                      ? '[ CABINA DE DESPACHO EN ESPERA ]' 
                      : '[ DISPATCH CABIN ON STANDBY ]'}
                  </span>
                  <p className="text-[10px] text-white/50 uppercase leading-relaxed max-w-xs font-mono">
                    {lang === 'es'
                      ? 'Por favor, haga click en cualquiera de los "Incidentes Activos" arriba para seleccionar el reporte y activar el Asistente de Asignación SOAE con su botón de despacho.'
                      : 'Please click any of the "Active Incidents" above to select the report and activate the SOAE Assignment Assistant with its dispatch button.'}
                  </p>
                </div>
              )}

              {selectedReportId && (
                <div className="bg-[#0a0a0a] border border-[#00FF41]/30 p-4 flex flex-col gap-3 rounded-none">
                  <span className="font-bold text-white border-b border-[#00FF41]/20 pb-2 uppercase tracking-wider flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-[#00FF41]" />
                      {lang === 'es' ? 'Asistente de Asignación SOAE' : 'SOAE Assignment Assistant'}
                    </span>
                    <button
                      onClick={() => setShowSoaeHelp(!showSoaeHelp)}
                      className="p-0.5 hover:bg-[#00FF41]/10 text-[#00FF41]/60 hover:text-[#00FF41] transition-colors rounded cursor-pointer"
                      title={lang === 'es' ? 'Explicación de la optimización' : 'Explanation of optimization'}
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  </span>

                  {showSoaeHelp && (
                    <div className="bg-[#00FF41]/5 border border-[#00FF41]/40 p-2.5 text-[10px] text-[#00FF41]/90 font-mono leading-relaxed relative">
                      <button
                        onClick={() => setShowSoaeHelp(false)}
                        className="absolute top-1 right-2 text-white hover:text-[#FF4444] font-bold text-xxs cursor-pointer"
                      >
                        [x]
                      </button>
                      <p className="font-bold border-b border-[#00FF41]/20 pb-1 mb-1.5 uppercase text-[#00FF41]">
                        {lang === 'es' ? 'ℹ️ Algoritmo de Asignación SOAE' : 'ℹ️ SOAE Assignment Algorithm'}
                      </p>
                      <p>
                        {lang === 'es'
                          ? 'El asistente autónomo calcula una puntuación de idoneidad matemática de 0 a 100 para cada unidad disponible, balanceando: correspondencia de especialidad (p. ej. Motobomba para Incendio), reserva de combustible, distancia geodésica real y reporte de congestión vial.'
                          : 'The autonomous assistant calculates a mathematical suitability score from 0 to 100 for each available unit, balancing: specialty match (e.g., Pumper for Fires), available fuel, geodesic distance, and road blockages.'}
                      </p>
                    </div>
                  )}

                  {optimizationAdvice ? (
                    <div className="flex flex-col gap-2">
                      {/* List of currently dispatched units to this specific incident */}
                      {(() => {
                        const assigned = currentUnits.filter(u => u.activeMissionId === selectedReportId);
                        if (assigned.length > 0) {
                          return (
                            <div className="bg-sky-500/5 p-2.5 border border-sky-400/30 rounded-none mb-1 font-mono text-sky-400">
                              <span className="text-[9px] block font-bold uppercase tracking-wider mb-1">
                                // {lang === 'es' ? 'VEHÍCULOS DESPACHADOS EN MISIÓN:' : 'VEHICLES DISPATCHED IN MISSION:'}
                              </span>
                              <div className="flex flex-col gap-1 text-[10px]">
                                {assigned.map(u => {
                                  let icon = '🚑';
                                  if (u.type === 'fire_truck') icon = '🚒';
                                  if (u.type === 'heavy_rescue') icon = '🚛';
                                  if (u.type === 'hazmat') icon = '☣️';
                                  return (
                                    <div key={u.id} className="flex justify-between items-center bg-black/40 border border-sky-400/10 p-1">
                                      <span className="font-bold flex items-center gap-1">
                                        <span>{icon}</span>
                                        <span>{u.name}</span>
                                      </span>
                                      <span className="text-[8px] px-1 bg-sky-400/20 text-sky-300 font-bold uppercase animate-pulse">
                                        {lang === 'es' ? 'EN RUTA' : 'IN ROUTE'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {optimizationAdvice.coDeployment && optimizationAdvice.coDeployment.length > 1 ? (
                        <div className="flex flex-col gap-2">
                          <div className="bg-black/50 p-2.5 border border-[#00FF41]/30 rounded-none">
                            <span className="text-[#00FF41]/60 text-[9px] block font-bold uppercase">// CO-DESPLIEGUE MULTI-VECTOR RECOMENDADO:</span>
                            <div className="flex flex-col gap-1.5 mt-1.5">
                              {optimizationAdvice.coDeployment.map((cd) => {
                                let icon = '🚑';
                                if (cd.unit.type === 'fire_truck') icon = '🚒';
                                if (cd.unit.type === 'heavy_rescue') icon = '🚛';
                                if (cd.unit.type === 'hazmat') icon = '☣️';
                                
                                return (
                                  <div key={cd.unit.id} className="flex justify-between items-center bg-black p-1.5 border border-[#00FF41]/10">
                                    <div className="flex flex-col">
                                      <span className="font-mono text-[10px] text-[#00FF41] font-bold flex items-center gap-1">
                                        <span>{icon}</span>
                                        <span>{cd.unit.name}</span>
                                      </span>
                                      <span className="text-[8px] text-[#00FF41]/50 font-mono">
                                        {lang === 'es' ? 'Idoneidad:' : 'Suitability:'} {cd.score.toFixed(1)} pts
                                      </span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        handleDispatchUnit(selectedReportId, cd.unit.id);
                                        addSystemLog(lang === 'es'
                                          ? `🚨 DESPACHO MANUAL: Unidad ${cd.unit.name} despachada.`
                                          : `🚨 MANUAL DISPATCH: Unit ${cd.unit.name} dispatched.`, 'warning');
                                      }}
                                      className="px-2 py-1 bg-[#00FF41]/20 hover:bg-[#00FF41] hover:text-black text-[#00FF41] font-mono text-[9px] font-bold border border-[#00FF41]/40 hover:border-transparent transition-all cursor-pointer rounded-none"
                                    >
                                      {lang === 'es' ? 'DESPACHAR' : 'DISPATCH'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {optimizationAdvice.reasons.length > 0 && (
                            <div className="bg-black p-2 border border-[#00FF41]/10 text-xxs text-[#00FF41]/70 rounded-none">
                              <span className="text-[#00FF41]/60 font-bold block mb-1 uppercase text-[9px]">// RESTRICCIONES DE SITUACIÓN:</span>
                              <div className="flex flex-col gap-1 text-[9px]">
                                {optimizationAdvice.reasons.map((r, i) => (
                                  <div key={i} className="flex gap-1 text-[#FFD700]">
                                    <span>•</span> <span>{r.toUpperCase()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            onClick={() => {
                              optimizationAdvice.coDeployment!.forEach(cd => {
                                handleDispatchUnit(selectedReportId, cd.unit.id);
                              });
                              addSystemLog(lang === 'es' 
                                ? `🚨 DESPACHO COMPLETO: Despachados todos los vehículos recomendados al incidente.`
                                : `🚨 COMPLETE DISPATCH: Dispatched all recommended vehicles to incident.`, 'warning');
                            }}
                            disabled={optimizationAdvice.isLocked}
                            className={`w-full py-2.5 border-2 font-black text-xs uppercase cursor-pointer transition-all rounded-none ${
                              optimizationAdvice.isLocked
                                ? 'bg-[#0f0a0a] text-red-500/50 border-red-500/20 cursor-not-allowed'
                                : 'bg-[#00FF41] text-black border-[#00FF41] hover:bg-transparent hover:text-[#00FF41]'
                            }`}
                          >
                            {optimizationAdvice.isLocked ? '[ CONTIENE RETÉN DE SEGURIDAD ]' : (lang === 'es' ? '[ DESPACHAR TODO EL CO-DESPLIEGUE ]' : '[ AUTHORIZE CO-DEPLOYMENT DISPATCH ]')}
                          </button>

                          {optimizationAdvice.isLocked && (
                            <div className="flex flex-col gap-1.5 mt-1 border border-yellow-500/30 bg-yellow-500/5 p-2 font-mono">
                              <span className="text-[9px] text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {lang === 'es' ? 'AVISO DEL PROTOCOLO DE RETÉN:' : 'SAFETY PROTOCOL NOTICE:'}
                              </span>
                              <p className="text-[9px] text-white/70 leading-relaxed uppercase">
                                {lang === 'es'
                                  ? 'Alguna de las unidades sugeridas es la última de su tipo en su sector. Use anulación para forzar.'
                                  : 'One of the suggested units is the last of its type in its sector. Use override to force.'}
                              </p>
                              <button
                                onClick={() => {
                                  optimizationAdvice.coDeployment!.forEach(cd => {
                                    handleDispatchUnit(selectedReportId, cd.unit.id);
                                  });
                                  addSystemLog(lang === 'es' 
                                    ? `⚠️ ANULACIÓN MANUAL: Co-despliegue forzado de todos los vehículos sugeridos.`
                                    : `⚠️ MANUAL OVERRIDE: Forced co-deployment of all suggested vehicles.`, 'warning');
                                }}
                                className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 border border-yellow-600 text-black font-black text-[10px] uppercase cursor-pointer transition-all rounded-none flex items-center justify-center gap-1.5 mt-0.5"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                {lang === 'es' ? 'SOBRESCRIBIR RETÉN Y DESPACHAR CO-DESPLIEGUE' : 'OVERRIDE SAFETY LOCK & DISPATCH CO-DEPLOYMENT'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : optimizationAdvice.optimalUnit ? (
                        <div className="flex flex-col gap-2">
                          <div className="bg-black p-2.5 border border-[#00FF41]/30 rounded-none">
                            <span className="text-[#00FF41]/60 text-[9px] block font-bold uppercase">// SUGERENCIA MÁXIMA DE DESPACHO:</span>
                            <span className="text-[#00FF41] font-black text-xs block mt-0.5">
                              {optimizationAdvice.optimalUnit.name}
                            </span>
                            <span className="text-xxs text-[#00FF41]/50 mt-1 block">
                              Métrica de idoneidad: {optimizationAdvice.score.toFixed(1)} pts
                            </span>
                          </div>

                          {optimizationAdvice.reasons.length > 0 && (
                            <div className="bg-black p-2 border border-[#00FF41]/10 text-xxs text-[#00FF41]/70 rounded-none">
                              <span className="text-[#00FF41]/60 font-bold block mb-1 uppercase text-[9px]">// RESTRICCIONES DE SITUACIÓN:</span>
                              <div className="flex flex-col gap-1 text-[9px]">
                                {optimizationAdvice.reasons.map((r, i) => (
                                  <div key={i} className="flex gap-1 text-[#FFD700]">
                                    <span>•</span> <span>{r.toUpperCase()}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                           <button
                            onClick={() => handleDispatchUnit(selectedReportId, optimizationAdvice.optimalUnit!.id)}
                            disabled={optimizationAdvice.isLocked}
                            className={`w-full py-2.5 border-2 font-black text-xs uppercase cursor-pointer transition-all rounded-none ${
                              optimizationAdvice.isLocked
                                ? 'bg-[#0f0a0a] text-red-500/50 border-red-500/20 cursor-not-allowed'
                                : 'bg-[#00FF41] text-black border-[#00FF41] hover:bg-transparent hover:text-[#00FF41]'
                            }`}
                          >
                            {optimizationAdvice.isLocked ? '[ CONTIENE RETÉN DE SEGURIDAD ]' : '[ AUTORIZAR DESPACHO ]'}
                          </button>

                          {optimizationAdvice.isLocked && (
                            <div className="flex flex-col gap-1.5 mt-1 border border-yellow-500/30 bg-yellow-500/5 p-2 font-mono">
                              <span className="text-[9px] text-yellow-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {lang === 'es' ? 'AVISO DEL PROTOCOLO DE RETÉN:' : 'SAFETY PROTOCOL NOTICE:'}
                              </span>
                              <p className="text-[9px] text-white/70 leading-relaxed uppercase">
                                {lang === 'es'
                                  ? 'La unidad sugerida es la última de su tipo en este sector. Para movilizarla debe aplicar la anulación manual.'
                                  : 'The suggested unit is the last of its type in this sector. You must apply manual override to dispatch.'}
                              </p>
                              <button
                                onClick={() => {
                                  addSystemLog(lang === 'es' 
                                    ? `⚠️ ANULACIÓN MANUAL: Despacho forzado de la unidad ${optimizationAdvice.optimalUnit!.name}`
                                    : `⚠️ MANUAL OVERRIDE: Forced dispatch of unit ${optimizationAdvice.optimalUnit!.name}`, 'warning');
                                  handleDispatchUnit(selectedReportId, optimizationAdvice.optimalUnit!.id);
                                }}
                                className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 border border-yellow-600 text-black font-black text-[10px] uppercase cursor-pointer transition-all rounded-none flex items-center justify-center gap-1.5 mt-0.5"
                              >
                                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                                {lang === 'es' ? 'SOBRESCRIBIR RETÉN DE SEGURIDAD Y DESPACHAR' : 'OVERRIDE SAFETY LOCK & DISPATCH'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xxs text-[#FF4444] bg-[#FF4444]/10 border border-[#FF4444]/40 p-3 rounded-none uppercase text-center font-bold">
                          Fallo de Optimización: No hay unidades de rescate disponibles.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 text-[#00FF41]/40 text-xxs uppercase">
                      Calculando matriz óptima de despacho...
                    </div>
                  )}
                </div>
              )}

              {/* FLEET TELEMETRY UNITS TABLE */}
              <div className="bg-[#0a0a0a] border border-[#00FF41]/30 p-4 flex flex-col gap-3 rounded-none">
                <div className="flex justify-between items-center border-b border-[#00FF41]/20 pb-2">
                  <span className="font-bold text-white uppercase tracking-wider text-xs">
                    {lang === 'es' ? 'Flota de Respuesta Táctica' : 'Tactical Response Fleet'}
                  </span>
                  <span className="text-[9px] text-[#00FF41]/60 font-mono">
                    {lang === 'es' ? 'CLICK PARA CONTROLAR' : 'CLICK TO CONTROL'}
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto">
                  {currentUnits.map((u) => {
                    const isSelected = selectedUnitId === u.id;
                    let statusColor = 'text-[#00FF41]/40';
                    let borderClass = 'border-[#00FF41]/10';
                    if (u.status === 'available') {
                      statusColor = 'text-[#00FF41]';
                      borderClass = 'border-[#00FF41]/20';
                    }
                    if (u.status === 'dispatched') {
                      statusColor = 'text-sky-400 animate-pulse font-bold';
                      borderClass = 'border-sky-400/40 bg-sky-400/5';
                    }

                    if (isSelected) {
                      borderClass = 'border-[#00FF41] bg-[#00FF41]/5';
                    }

                    let listIcon = <Flame className="w-3.5 h-3.5 text-red-500 shrink-0" />;
                    if (u.type === 'heavy_rescue') listIcon = <Truck className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
                    if (u.type === 'hazmat') listIcon = <Biohazard className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
                    if (u.type === 'ambulance') listIcon = <Activity className="w-3.5 h-3.5 text-green-500 shrink-0" />;

                    return (
                      <div
                        key={u.id}
                        onClick={() => setSelectedUnitId(isSelected ? undefined : u.id)}
                        className={`bg-black p-2.5 border ${borderClass} flex flex-col gap-1 text-xxs rounded-none cursor-pointer transition-all hover:bg-stone-900/60`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`font-bold flex items-center gap-1.5 ${isSelected ? 'text-[#00FF41]' : 'text-white'}`}>
                            {listIcon}
                            <span>{u.name.toUpperCase()} {isSelected && '⌖'}</span>
                          </span>
                          <span className={`${statusColor} font-bold text-[9px] uppercase`}>
                            {u.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-[#00FF41]/60 text-[10px]">
                          <span>{lang === 'es' ? 'COMBUSTIBLE' : 'FUEL'}: {u.batteryOrFuel.toFixed(0)}%</span>
                          {u.status === 'dispatched' && (
                            <span className="text-sky-400 uppercase font-bold text-[9px]">
                              {u.activeMissionId === 'return-home' ? (lang === 'es' ? '🏠 RETORNO' : '🏠 BASE') : (lang === 'es' ? '🚨 MISION' : '🚨 EN ROUTE')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SELECTED UNIT REAL-TIME TELEMETRY & COMMAND PANEL */}
              {selectedUnitId && (() => {
                const selectedUnit = currentUnits.find((u) => u.id === selectedUnitId);
                if (!selectedUnit) return null;

                let iconComponent = <Flame className="w-4 h-4 text-red-500 shrink-0" />;
                if (selectedUnit.type === 'heavy_rescue') iconComponent = <Truck className="w-4 h-4 text-yellow-500 shrink-0" />;
                if (selectedUnit.type === 'hazmat') iconComponent = <Biohazard className="w-4 h-4 text-purple-500 shrink-0" />;
                if (selectedUnit.type === 'ambulance') iconComponent = <Activity className="w-4 h-4 text-green-500 shrink-0" />;

                return (
                  <div className="bg-black border-2 border-[#00FF41] p-4 flex flex-col gap-3 rounded-none shadow-[0_0_15px_rgba(0,255,65,0.15)]">
                    <div className="flex justify-between items-center border-b border-[#00FF41]/30 pb-2">
                      <div className="flex items-center gap-1.5">
                        {iconComponent}
                        <span className="text-[#00FF41] font-black uppercase tracking-wider text-xs">
                          {selectedUnit.name.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedUnitId(undefined)}
                        className="text-stone-500 hover:text-white font-bold text-xxs cursor-pointer"
                      >
                        [X]
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div className="bg-stone-950/80 border border-stone-900 p-2">
                        <span className="text-stone-500 block text-[8px] uppercase">{lang === 'es' ? 'Estado actual:' : 'Status:'}</span>
                        <span className={`font-bold uppercase ${
                          selectedUnit.status === 'available' ? 'text-[#00FF41]' : 'text-sky-400 animate-pulse'
                        }`}>{selectedUnit.status}</span>
                      </div>
                      <div className="bg-stone-950/80 border border-stone-900 p-2">
                        <span className="text-stone-500 block text-[8px] uppercase">{lang === 'es' ? 'Combustible/Batería:' : 'Fuel/Battery:'}</span>
                        <span className={`font-bold ${selectedUnit.batteryOrFuel < 20 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                          {selectedUnit.batteryOrFuel.toFixed(1)}%
                        </span>
                      </div>
                      <div className="bg-stone-950/80 border border-stone-900 p-2 col-span-2">
                        <span className="text-stone-500 block text-[8px] uppercase">{lang === 'es' ? 'Coordenadas y Rumbo:' : 'Coords & Heading:'}</span>
                        <span className="text-white">
                          [{selectedUnit.lat.toFixed(5)}, {selectedUnit.lon.toFixed(5)}] • {selectedUnit.bearing}° ({
                            selectedUnit.bearing >= 337.5 || selectedUnit.bearing < 22.5 ? 'N' :
                            selectedUnit.bearing >= 22.5 && selectedUnit.bearing < 67.5 ? 'NE' :
                            selectedUnit.bearing >= 67.5 && selectedUnit.bearing < 112.5 ? 'E' :
                            selectedUnit.bearing >= 112.5 && selectedUnit.bearing < 157.5 ? 'SE' :
                            selectedUnit.bearing >= 157.5 && selectedUnit.bearing < 202.5 ? 'S' :
                            selectedUnit.bearing >= 202.5 && selectedUnit.bearing < 247.5 ? 'SO' :
                            selectedUnit.bearing >= 247.5 && selectedUnit.bearing < 292.5 ? 'O' : 'NO'
                          })
                        </span>
                      </div>
                      <div className="bg-stone-950/80 border border-stone-900 p-2 col-span-2">
                        <span className="text-stone-500 block text-[8px] uppercase">{lang === 'es' ? 'Velocidad Satelital:' : 'Satellite Speed:'}</span>
                        <span className="text-white font-bold">{selectedUnit.speed.toFixed(1)} km/h</span>
                      </div>
                      <div className="bg-stone-950/80 border border-stone-900 p-2 col-span-2">
                        <span className="text-stone-500 block text-[8px] uppercase">{lang === 'es' ? 'Misión de Despliegue:' : 'Deployment Mission:'}</span>
                        <span className="text-sky-400 font-bold uppercase text-[9px] break-all">
                          {selectedUnit.activeMissionId === 'return-home' 
                            ? (lang === 'es' ? '🏠 RETORNANDO A ESTACIÓN BASE' : '🏠 RETURNING TO BASE')
                            : selectedUnit.activeMissionId?.startsWith('cover-')
                            ? (lang === 'es' ? `🛡️ COBERTURA DE SECTOR ${selectedUnit.activeMissionId.substring(6).toUpperCase()}` : `🛡️ SECTOR COVERAGE ${selectedUnit.activeMissionId.substring(6).toUpperCase()}`)
                            : selectedUnit.activeMissionId 
                            ? `🚨 EMERGENCIA: ${selectedUnit.activeMissionId}`
                            : (lang === 'es' ? '✓ DISPONIBLE EN BASE (PASIVO)' : '✓ STANDBY AT BASE (PASSIVE)')}
                        </span>
                      </div>
                    </div>

                    {/* ACTIONS CONTROL PANEL FOR SELECTED UNIT */}
                    <div className="flex flex-col gap-1.5 mt-1">
                      <span className="text-[8px] text-[#00FF41]/50 font-bold uppercase tracking-wider block font-mono">
                        {lang === 'es' ? '// SISTEMA DE CONTROL DE TELEMETRÍA EN TIEMPO REAL:' : '// REAL-TIME TELEMETRY CONTROL:'}
                      </span>

                      <div className="grid grid-cols-1 gap-1.5">
                        {/* Dispatch to Selected Incident Override Button */}
                        {selectedReportId && selectedUnit.status === 'available' && (
                          <button
                            onClick={() => {
                              handleDispatchUnit(selectedReportId, selectedUnit.id);
                              addSystemLog(lang === 'es'
                                ? `🚨 DESPACHO MANUAL: Unidad ${selectedUnit.name} despachada al incidente seleccionado ${selectedReportId.substring(0, 8)}.`
                                : `🚨 MANUAL DISPATCH: Unit ${selectedUnit.name} dispatched to selected incident ${selectedReportId.substring(0, 8)}.`, 'warning');
                            }}
                            className="py-2.5 bg-[#00FF41]/20 hover:bg-[#00FF41] border border-[#00FF41]/40 hover:border-black text-[#00FF41] hover:text-black font-mono text-[9px] uppercase font-bold cursor-pointer transition-all rounded-none flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(0,255,65,0.15)] animate-pulse"
                          >
                            <span>⚡</span>
                            {lang === 'es' 
                              ? `DESPACHAR ESTA UNIDAD AL INCIDENTE SELECCIONADO` 
                              : `DISPATCH THIS UNIT TO SELECTED INCIDENT`}
                          </button>
                        )}

                        {/* Button 1: Force Stop and Free */}
                        <button
                          onClick={() => {
                            const updatedUnit = {
                              ...selectedUnit,
                              status: 'available' as const,
                              activeMissionId: undefined,
                              routePoints: undefined,
                              currentRouteIndex: undefined,
                              speed: 0
                            };
                            handleUpdateTelemetry(selectedUnit.id, updatedUnit);
                            addSystemLog(lang === 'es' 
                              ? `🛰️ ORDEN REMOTA: Unidad ${selectedUnit.name} forzada a estado DISPONIBLE (detenida).`
                              : `🛰️ REMOTE COMMAND: Unit ${selectedUnit.name} forced to AVAILABLE status (stopped).`, 'info');
                          }}
                          className="py-1.5 bg-[#0a0a0a] hover:bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-300 hover:text-white font-mono text-[9px] uppercase cursor-pointer transition-all rounded-none"
                        >
                          {lang === 'es' ? '⏸️ Forzar Parada y Liberar (Disponible)' : '⏸️ Force Stop & Release (Available)'}
                        </button>

                        {/* Button 2: One-Click Return to Base (Optimal Route) */}
                        <button
                          disabled={selectedUnit.status === 'available' && !selectedUnit.activeMissionId}
                          onClick={() => {
                            handleReturnToBase(selectedUnit.id);
                          }}
                          className={`py-1.5 font-mono text-[9px] uppercase cursor-pointer transition-all rounded-none font-bold ${
                            selectedUnit.status === 'available' && !selectedUnit.activeMissionId
                              ? 'bg-black/20 text-stone-600 border border-stone-900 cursor-not-allowed'
                              : 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-500/60 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                          }`}
                          title={lang === 'es' ? 'Retorno táctico instantáneo con desvíos y optimización de ruta' : 'Instant tactical return with real-time detour and optimal route planning'}
                        >
                          {lang === 'es' ? '🏠 Retorno a Base con Un Clic (Ruta Óptima)' : '🏠 One-Click Return to Base (Optimal Route)'}
                        </button>

                        {/* Button 3: Recharge or Refuel */}
                        <button
                          onClick={() => {
                            const updatedUnit = {
                              ...selectedUnit,
                              batteryOrFuel: 100
                            };
                            handleUpdateTelemetry(selectedUnit.id, updatedUnit);
                            addSystemLog(lang === 'es'
                              ? `🔋 RECARGA REMOTA: Batería/Combustible de ${selectedUnit.name} restablecido al 100%.`
                              : `🔋 REMOTE CHARGE: Battery/Fuel of ${selectedUnit.name} restored to 100%.`, 'info');
                          }}
                          className="py-1.5 bg-[#0a0a0a] hover:bg-stone-900 border border-[#00FF41]/30 hover:border-[#00FF41]/60 text-[#00FF41] font-mono text-[9px] uppercase cursor-pointer transition-all rounded-none"
                        >
                          {lang === 'es' ? '🔋 Cargar Combustible / Batería al 100%' : '🔋 Refuel / Charge Battery to 100%'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

          </div>
        )}

        {/* ==========================================
            TAB: GLOBAL OPERATIONS DASHBOARD (METRICS)
            ========================================== */}
        {activeTab === 'dashboard' && (
          <div className="h-full overflow-y-auto">
            <GlobalOperationsDashboard
              sectors={sectors}
              units={units}
              reports={reports}
              drillSectors={drillSectors}
              drillUnits={drillUnits}
              drillReports={drillReports}
              drillSession={drillSession}
              drillPerformance={drillPerformance}
              lang={lang}
              currentRegion={currentRegion}
            />
          </div>
        )}

        {/* ==========================================
            TAB: SOAE AUTONOMOUS DECISION LEDGER
            ========================================== */}
        {activeTab === 'decisions' && (
          <div className="h-full overflow-y-auto">
            <div className="p-6">
              <AutonomousDecisionLedger
                decisions={autonomousDecisions}
                lang={lang}
              />
            </div>
          </div>
        )}

        {/* ==========================================
            TAB 2: FULL COMPASS VEHICLE TABLET
            ========================================== */}
        {activeTab === 'tablet' && (
          <div className="h-full p-4 overflow-y-auto">
            <CopilotView
              units={units}
              reports={reports}
              onTriggerRouteBlocked={handleTriggerRouteBlocked}
              onUpdateTelemetry={handleUpdateTelemetry}
              isSimulation={drillSession?.isActive}
              lang={lang}
            />
          </div>
        )}

        {/* ==========================================
            TAB 3: DIGITAL TWIN PREDICTIVE STRESS-TESTING
            ========================================== */}
        {activeTab === 'sim' && (
          <div className="h-full p-4 overflow-y-auto">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 pb-8">
              
              {/* STRESS TEST CONTROLS (4 Cols) */}
              <div className="md:col-span-4 bg-[#0a0a0a] border-2 border-[#00FF41]/30 p-5 flex flex-col gap-4 rounded-none">
                <div className="border-b border-[#00FF41]/20 pb-2.5">
                  <h3 className="text-white text-sm font-black uppercase tracking-wider">// GEMELO DIGITAL PREDICTIVO</h3>
                  <p className="text-[10px] text-[#00FF41]/60 mt-1 uppercase font-bold">Simulador Estocástico de Crisis</p>
                </div>

                <form onSubmit={handleRunStressTest} className="flex flex-col gap-4">
                  <div>
                    <label className="text-xxs text-[#00FF41]/70 font-bold block mb-1 uppercase">// ESCENARIO CATÁSTROFE:</label>
                    <select
                      value={simConfig.type}
                      onChange={(e) => setSimConfig({ ...simConfig, type: e.target.value as DisasterType })}
                      className="w-full bg-black border border-[#00FF41]/40 px-3 py-2 text-xs font-bold text-[#00FF41] focus:outline-none focus:border-[#00FF41] rounded-none cursor-pointer"
                    >
                      <option value="earthquake">Sismo Mayor (Derrumbe)</option>
                      <option value="wildfire">Incendio Forestal de Interfaz</option>
                      <option value="chemical_spill">Fuga de Químicos Industriales</option>
                      <option value="tsunami">Inundación por Tsunami Costero</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xxs text-[#00FF41]/70 font-bold block mb-1 uppercase">// MAGNITUD:</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1.0"
                        max="10.0"
                        value={simConfig.magnitude}
                        onChange={(e) => setSimConfig({ ...simConfig, magnitude: Number(e.target.value) })}
                        className="w-full bg-black border border-[#00FF41]/40 px-3 py-1.5 text-xs text-white font-bold rounded-none focus:outline-none focus:border-[#00FF41]"
                      />
                    </div>
                    <div>
                      <label className="text-xxs text-[#00FF41]/70 font-bold block mb-1 uppercase">// RADIO (KM):</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={simConfig.radius}
                        onChange={(e) => setSimConfig({ ...simConfig, radius: Number(e.target.value) })}
                        className="w-full bg-black border border-[#00FF41]/40 px-3 py-1.5 text-xs text-white font-bold rounded-none focus:outline-none focus:border-[#00FF41]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xxs text-[#00FF41]/70 font-bold block mb-1 uppercase">// POBLACIÓN EXPUESTA DIRECTA:</label>
                    <input
                      type="number"
                      min="100"
                      max="10000000"
                      value={simConfig.populationAffected}
                      onChange={(e) => setSimConfig({ ...simConfig, populationAffected: Number(e.target.value) })}
                      className="w-full bg-black border border-[#00FF41]/40 px-3 py-1.5 text-xs text-white font-bold rounded-none focus:outline-none focus:border-[#00FF41]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSimulating}
                    className="w-full py-3 bg-[#00FF41] text-black font-black uppercase border-2 border-[#00FF41] hover:bg-transparent hover:text-[#00FF41] shadow transition-all flex items-center justify-center gap-2 text-xs rounded-none cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    {isSimulating ? 'MODELANDO OPTIMIZACIÓN...' : '[ EJECUTAR STRESS-TESTING ]'}
                  </button>
                </form>
              </div>

              {/* SIMULATION RESULTS PRESCRIPTION (8 Cols) */}
              <div className="md:col-span-8 flex flex-col gap-6">
                
                {simResult ? (
                  <div className="flex flex-col gap-6">
                    
                    {/* KEY HUD STATISTICS SUMMARY */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-[#0a0a0a] border border-[#00FF41]/30 p-4 rounded-none">
                        <span className="text-xxs text-[#00FF41]/60 font-bold block uppercase">// SUPERVIVENCIA BASE</span>
                        <span className="text-3xl font-black text-white mt-1.5 block">
                          {simResult.overallSurvivalRate}%
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#FF4444] mt-2.5">
                          <TrendingDown className="w-4 h-4" />
                          <span className="font-bold uppercase">DÉFICIT DEL {100 - simResult.overallSurvivalRate}%</span>
                        </div>
                      </div>

                      <div className="bg-[#0a0a0a] border border-[#00FF41]/30 p-4 rounded-none">
                        <span className="text-[#00FF41]/60 text-xxs font-bold block uppercase">// PROYECCIÓN VÍCTIMAS</span>
                        <span className="text-3xl font-black text-[#FF4444] mt-1.5 block">
                          {simResult.estimatedCasualties.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-[#00FF41]/50 mt-2.5 block font-mono">CÁLCULO EXPONENCIAL DE DESVANECIMIENTO</span>
                      </div>

                      <div className="bg-[#0a0a0a] border border-[#FFD700]/30 p-4 rounded-none">
                        <span className="text-[#FFD700]/60 text-xxs font-bold block uppercase">// ÍNDICE GENERAL DE RIESGO</span>
                        <span className="text-3xl font-black text-[#FFD700] mt-1.5 block">
                          {simResult.calculatedRiskScore} <span className="text-xs font-normal text-[#FFD700]/60">/ 100</span>
                        </span>
                        <span className="text-[10px] text-[#00FF41]/50 mt-2.5 block font-mono">MAGNITUD E INCIDENTES GEOLOCALIZADOS</span>
                      </div>
                    </div>

                    {/* RECURSOS REQUERIDOS - INVERSE OPTIMIZATION RESULTS */}
                    <div className="bg-[#0a0a0a] border-2 border-[#00FF41]/30 p-5 rounded-none">
                      <h4 className="text-white text-xs font-black uppercase border-b border-[#00FF41]/20 pb-2.5 mb-3.5 flex justify-between items-center">
                        <span>PRESCRIPCIÓN DE MATRIZ DE RECURSOS ADICIONALES (MÉTODOS INVERSOS)</span>
                        <span className="text-xxs text-[#00FF41] bg-[#00FF41]/10 border border-[#00FF41]/30 px-2 py-0.5 font-bold uppercase rounded-none">META SUPERVIVENCIA: 99%</span>
                      </h4>

                      <p className="text-xxs text-[#00FF41]/60 mb-4 font-mono leading-relaxed uppercase">
                        Para contrarrestar el déficit de supervivencia bajo el escenario modelado y asegurar un rescate seguro superior al 99% de efectividad, la simulación inversa determina que es obligatorio desplegar la siguiente dotación de unidades tácticas y bomberos:
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-black p-3 border border-[#00FF41]/20 text-center rounded-none">
                          <span className="text-xxs text-[#00FF41]/60 block uppercase font-bold">Camiones Bomba</span>
                          <span className="text-xl font-black text-[#00FF41] block mt-1">+{simResult.resourceDeficit.fire_truck}</span>
                          <span className="text-[9px] text-[#00FF41]/40 block mt-1">+{simResult.resourceDeficit.fire_truck * 4} Bomberos</span>
                        </div>
                        <div className="bg-black p-3 border border-[#00FF41]/20 text-center rounded-none">
                          <span className="text-xxs text-[#00FF41]/60 block uppercase font-bold">Rescate Pesado</span>
                          <span className="text-xl font-black text-[#00FF41] block mt-1">+{simResult.resourceDeficit.heavy_rescue}</span>
                          <span className="text-[9px] text-[#00FF41]/40 block mt-1">+{simResult.resourceDeficit.heavy_rescue * 5} Rescatistas</span>
                        </div>
                        <div className="bg-black p-3 border border-[#00FF41]/20 text-center rounded-none">
                          <span className="text-xxs text-[#00FF41]/60 block uppercase font-bold">Ambulancias</span>
                          <span className="text-xl font-black text-[#00FF41] block mt-1">+{simResult.resourceDeficit.ambulance}</span>
                          <span className="text-[9px] text-[#00FF41]/40 block mt-1">+{simResult.resourceDeficit.ambulance * 3} Paramédicos</span>
                        </div>
                        <div className="bg-black p-3 border border-[#00FF41]/20 text-center rounded-none">
                          <span className="text-xxs text-[#00FF41]/60 block uppercase font-bold">Hazmat</span>
                          <span className="text-xl font-black text-[#00FF41] block mt-1">+{simResult.resourceDeficit.hazmat}</span>
                          <span className="text-[9px] text-[#00FF41]/40 block mt-1">+{simResult.resourceDeficit.hazmat * 4} Especialistas</span>
                        </div>
                      </div>

                      {/* Recalculate estimated firefighters and base structures */}
                      <div className="bg-black border border-[#00FF41]/20 p-3 mt-4 text-xxs flex justify-between rounded-none font-mono text-[#00FF41]/80">
                        <div>
                          Estaciones Adicionales Proyectadas:{' '}
                          <span className="text-white font-bold">
                            +{Math.ceil((simResult.resourceDeficit.fire_truck + simResult.resourceDeficit.heavy_rescue) / 2.5)}
                          </span>
                        </div>
                        <div>
                          Personal Adicional en Guardia:{' '}
                          <span className="text-white font-bold">
                            +{(simResult.resourceDeficit.fire_truck * 4) +
                              (simResult.resourceDeficit.heavy_rescue * 5) +
                              (simResult.resourceDeficit.ambulance * 3) +
                              (simResult.resourceDeficit.hazmat * 4)}{' '}
                            operativos
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* INVENTORY GAP ANALYTICS LIST */}
                    <div className="bg-[#0a0a0a] border border-[#00FF41]/30 p-5 rounded-none">
                      <h4 className="text-white text-xs font-black uppercase border-b border-[#00FF41]/20 pb-2.5 mb-3.5 tracking-wider">
                        BRECHA DE INVENTARIOS DE LOGÍSTICA // INVENTORY_GAPS
                      </h4>

                      <div className="flex flex-col gap-2.5">
                        {simResult.inventoryPrescription.map((item, idx) => {
                          const priorityColor =
                            item.priority === 'high'
                              ? 'text-[#FF4444] bg-[#FF4444]/10 border border-[#FF4444]/40'
                              : item.priority === 'medium'
                                ? 'text-[#FFD700] bg-[#FFD700]/10 border border-[#FFD700]/40'
                                : 'text-[#00FF41]/60 bg-[#00FF41]/5 border border-[#00FF41]/20';

                          const deficitRatio = (item.deficit / item.required) * 100;

                          return (
                            <div key={idx} className="bg-black p-3 border border-[#00FF41]/20 flex flex-col gap-2 rounded-none">
                              <div className="flex justify-between items-center text-xxs">
                                <span className="font-bold text-white uppercase">{item.item}</span>
                                <span className={`px-2 py-0.5 text-[9px] font-bold ${priorityColor}`}>
                                  PRIORIDAD: {item.priority.toUpperCase()}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-2 text-[10px] text-[#00FF41]/70 font-mono">
                                <div>Requerido: <span className="text-white font-bold">{item.required} u</span></div>
                                <div>Disponible: <span className="text-white font-bold">{item.current} u</span></div>
                                <div className="text-right">Déficit: <span className="text-[#FF4444] font-bold">-{item.deficit} u</span></div>
                              </div>

                              <div className="w-full bg-[#111111] border border-[#00FF41]/10 h-1.5 overflow-hidden mt-1 rounded-none">
                                <div
                                  className="h-full bg-[#00FF41]"
                                  style={{ width: `${100 - deficitRatio}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="flex-1 border-2 border-dashed border-[#00FF41]/20 flex flex-col items-center justify-center p-12 text-center text-[#00FF41]/40 min-h-[400px] rounded-none">
                    <Sparkles className="w-12 h-12 text-[#00FF41]/20 mb-3 animate-pulse" />
                    <div>
                      <div className="text-sm text-[#00FF41] font-black uppercase tracking-wider">INICIALIZAR MOTOR DE SIMULACIÓN INVERSA</div>
                      <p className="text-xxs text-[#00FF41]/50 max-w-sm mt-2 mx-auto leading-relaxed uppercase font-mono">
                        Configure las variables geográficas y la escala de fuerza de catástrofe en el panel izquierdo y active el simulador para modelar brechas operativas en tiempo real.
                      </p>
                    </div>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

        {/* ==========================================
            TAB 5: PORTAL CIUDADANO (SOS)
            ========================================== */}
        {activeTab === 'citizen' && (
          <div className="h-full overflow-y-auto p-4 md:p-6 text-white font-mono bg-[#030303]">
            <div className="max-w-4xl mx-auto flex flex-col gap-6">
              
              {/* ACCESSIBILITY & HUD CONFIGURATION HEADER */}
              <div className="bg-black border border-[#FF3333]/30 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-[#FF3333] font-black tracking-widest text-sm flex items-center gap-2 uppercase">
                    <Radio className="w-5 h-5 text-[#FF3333] animate-pulse" />
                    SOAE // Portal Ciudadano de Auxilio Extremo
                  </h2>
                  <p className="text-[10px] text-white/50 mt-1 uppercase font-semibold">
                    Línea satelital de prioridad civil de un solo toque
                  </p>
                </div>
                
                {/* Geolocation Live HUD */}
                <div className="flex flex-wrap items-center gap-2 text-xxs">
                  <div className="flex items-center gap-2 bg-[#FF3333]/10 border border-[#FF3333]/30 px-3 py-1.5 font-bold">
                    <MapPin className={`w-3.5 h-3.5 ${citizenLocating ? 'animate-bounce text-[#FFD700]' : 'text-[#00FF41]'}`} />
                    <span>
                      {citizenLocating
                        ? 'SINCRO GPS...'
                        : citizenCoords
                        ? `LAT: ${citizenCoords.lat.toFixed(5)} / LON: ${citizenCoords.lon.toFixed(5)}`
                        : 'GPS DESCONECTADO'}
                    </span>
                    {citizenCoords?.accuracy && (
                      <span className="text-white/40 font-normal">
                        (±{citizenCoords.accuracy}m)
                      </span>
                    )}
                  </div>

                  <button
                    onClick={acquireCitizenLocation}
                    className="px-3 py-1.5 bg-black border border-white/20 hover:border-[#FF3333] transition-colors font-bold uppercase cursor-pointer"
                  >
                    Actualizar GPS
                  </button>
                </div>
              </div>

              {/* DUAL COGNITIVE SUPPORT MODES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Voice Toggle */}
                <button
                  onClick={() => {
                    const next = !voiceGuidance;
                    setVoiceGuidance(next);
                    if (next) {
                      speakInstruction("Guía por voz activada. Seleccione uno de los cuatro botones gigantes de abajo en caso de emergencia.");
                    }
                  }}
                  className={`p-4 border transition-all flex items-center justify-between cursor-pointer ${
                    voiceGuidance
                      ? 'bg-[#FF3333]/10 border-[#FF3333] text-white'
                      : 'bg-black border-white/10 text-white/50'
                  }`}
                >
                  <div className="text-left">
                    <span className="text-xs font-bold block uppercase tracking-wider">// GUÍA POR VOZ ACTIVA</span>
                    <span className="text-[10px] text-white/50 block mt-0.5">Lectura de estado de auxilio por síntesis de voz</span>
                  </div>
                  {voiceGuidance ? <Volume2 className="w-6 h-6 text-[#FF3333]" /> : <VolumeX className="w-6 h-6 text-white/30" />}
                </button>

                {/* Broken Screen Override */}
                <button
                  onClick={() => {
                    const next = !shatteredScreenMode;
                    setShatteredScreenMode(next);
                    if (next) {
                      speakInstruction("Modo pantalla rota activo. Los botones ahora cubren el cien por ciento de la pantalla para pulsación táctil forzada.");
                    }
                  }}
                  className={`p-4 border transition-all flex items-center justify-between cursor-pointer ${
                    shatteredScreenMode
                      ? 'bg-[#FFD700]/15 border-[#FFD700] text-[#FFD700]'
                      : 'bg-black border-white/10 text-white/50'
                  }`}
                >
                  <div className="text-left">
                    <span className="text-xs font-bold block uppercase tracking-wider">// MODO PANTALLA ROTA</span>
                    <span className="text-[10px] text-white/50 block mt-0.5">Botones gigantescos y brillo máximo en cristales fisurados</span>
                  </div>
                  <Smartphone className={`w-6 h-6 ${shatteredScreenMode ? 'text-[#FFD700] animate-pulse' : 'text-white/30'}`} />
                </button>

              </div>

              {/* CONTINUOUS BIOMETRIC VITAL SIGNALS SAFEGUARD MONITOR */}
              <div className="bg-black border border-white/10 p-4 flex flex-col gap-4 rounded-none">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 text-[#00FF41]">
                      <Activity className={`w-4 h-4 ${biometricConsent ? 'animate-pulse text-red-500' : 'text-stone-500'}`} />
                      {lang === 'es' ? 'ENLACE BIOMÉTRICO CONTINUO' : 'CONTINUOUS BIOMETRIC TELEMETRY'}
                    </h3>
                    <span className="text-[9px] text-white/50 uppercase block mt-0.5">
                      {lang === 'es' 
                        ? 'Sincronización autónoma con relojes inteligentes y biosensores de muñeca' 
                        : 'Autonomous smartwatch & biosensor background synchronization'}
                    </span>
                  </div>

                  {/* Toggle switch for consent/privacy */}
                  <div className="flex items-center gap-2 bg-[#050505] p-1.5 border border-white/10">
                    <input
                      type="checkbox"
                      id="consent-checkbox-citizen"
                      checked={biometricConsent}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setBiometricConsent(next);
                        if (!next) {
                          setBiometricCountdown(null);
                        }
                        addSystemLog(
                          lang === 'es'
                            ? `TELEMETRÍA: Monitoreo biométrico continuo ${next ? 'AUTORIZADO por consentimiento' : 'DESACTIVADO por el usuario'}.`
                            : `TELEMETRY: Continuous biometric monitoring ${next ? 'AUTHORIZED by user consent' : 'DISABLED by user'}.`,
                          next ? 'info' : 'warning'
                        );
                        if (next && voiceGuidance) {
                          speakInstruction(
                            lang === 'es'
                              ? 'Monitoreo biométrico continuo activado. Sus señales vitales ahora están seguras bajo resguardo satelital.'
                              : 'Continuous biometric monitoring enabled. Your vital signs are now safeguarded by satellite systems.'
                          );
                        }
                      }}
                      className="w-4 h-4 accent-[#00FF41] cursor-pointer rounded-none border border-white/20"
                    />
                    <label htmlFor="consent-checkbox-citizen" className="text-[10px] font-bold text-white uppercase cursor-pointer select-none">
                      {biometricConsent ? (lang === 'es' ? 'ACTIVO / CON SENTIMIENTO' : 'ACTIVE / CONSENTED') : (lang === 'es' ? 'DESACTIVADO' : 'DISABLED')}
                    </label>
                  </div>
                </div>

                {!biometricConsent ? (
                  <div className="bg-[#FF3333]/5 border border-[#FF3333]/20 p-3 text-center flex flex-col items-center gap-2">
                    <p className="text-xxs text-white/75 leading-relaxed uppercase">
                      {lang === 'es'
                        ? '⚠️ El monitoreo continuo está desactivado para respetar su privacidad y cumplimiento legal. Active la casilla de arriba para autorizar la lectura de señales vitales de fondo y habilitar el despacho de auxilio autónomo si queda inconsciente.'
                        : '⚠️ Continuous monitoring is disabled to respect your privacy and legal compliance. Toggle the checkbox above to authorize background vital signals check and enable autonomous rescue dispatch if you lose consciousness.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Live Vitals HUD Layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      
                      {/* Meter 1: Heart Rate */}
                      <div className="bg-[#050505] p-3 border border-white/10 flex items-center gap-3">
                        <Heart className={`w-8 h-8 text-red-500 ${biometricActivity === 'resting' || biometricActivity === 'active' ? 'animate-heartbeat' : biometricActivity === 'crash_detected' || biometricActivity === 'critical_low' ? 'animate-ping' : ''}`} style={{ animationDuration: biometricActivity === 'critical_low' ? '1.5s' : '0.8s' }} />
                        <div className="flex flex-col">
                          <span className="text-[8px] text-white/50 uppercase tracking-widest block font-bold">// HEART RATE</span>
                          <span className={`text-xl font-black ${biometricActivity === 'critical_low' || biometricActivity === 'crash_detected' ? 'text-red-500' : 'text-white'}`}>
                            {biometricHeartRate} <span className="text-xs font-normal text-white/40">BPM</span>
                          </span>
                        </div>
                      </div>

                      {/* Meter 2: Oxygen */}
                      <div className="bg-[#050505] p-3 border border-white/10 flex items-center gap-3">
                        <Activity className="w-8 h-8 text-cyan-400" />
                        <div className="flex flex-col">
                          <span className="text-[8px] text-white/50 uppercase tracking-widest block font-bold">// BLOOD OXYGEN</span>
                          <span className={`text-xl font-black ${biometricActivity === 'critical_low' ? 'text-red-500' : 'text-white'}`}>
                            {biometricOxygen}% <span className="text-xs font-normal text-white/40">SpO2</span>
                          </span>
                        </div>
                      </div>

                      {/* Meter 3: Decelerometer / Fall detection status */}
                      <div className="bg-[#050505] p-3 border border-white/10 flex items-center gap-3">
                        <Gauge className="w-8 h-8 text-amber-500" />
                        <div className="flex flex-col">
                          <span className="text-[8px] text-white/50 uppercase tracking-widest block font-bold">// MOTION STATS</span>
                          <span className="text-xxs font-black uppercase text-[#00FF41] flex items-center gap-1 mt-1">
                            <span className={`w-1.5 h-1.5 rounded-full bg-[#00FF41] ${biometricActivity !== 'resting' ? 'animate-ping' : ''}`} />
                            {biometricActivity === 'resting' && (lang === 'es' ? 'ESTABLE / REPOSO' : 'STABLE / RESTING')}
                            {biometricActivity === 'active' && (lang === 'es' ? 'MOVIMIENTO ACTIVO' : 'ACTIVE MOTION')}
                            {biometricActivity === 'crash_detected' && (lang === 'es' ? '💥 CAÍDA DETECTADA' : '💥 FALL DETECTED')}
                            {biometricActivity === 'critical_low' && (lang === 'es' ? '⚠️ SHOCK BIOLÓGICO' : '⚠️ BIOLOGICAL SHOCK')}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Simulation Trigger button when vitals are normal */}
                    {biometricCountdown === null ? (
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button
                          onClick={() => {
                            setBiometricHeartRate(35);
                            setBiometricOxygen(88);
                            setBiometricActivity('crash_detected');
                            setBiometricCountdown(10);
                            addSystemLog(
                              lang === 'es'
                                ? '⚠️ ALERTA BIOMÉTRICA: Biosensor detectó impacto cinético de 8.2G seguido de desaceleración súbita. Iniciando cuenta regresiva de resguardo táctil (10s)...'
                                : '⚠️ BIOMETRIC ALERT: Biosensor detected 8.2G kinetic impact followed by sudden deceleration. Initiating safeguard countdown (10s)...',
                              'danger'
                            );
                            if (voiceGuidance) {
                              speakInstruction(
                                lang === 'es'
                                  ? 'Alerta vital. Caída detectada. Responda al dispositivo en diez segundos para cancelar el despacho autónomo de rescate.'
                                  : 'Vital alert. Fall detected. Respond to device within ten seconds to cancel autonomous rescue dispatch.'
                              );
                            }
                          }}
                          className="flex-1 py-3 bg-[#FF3333]/15 hover:bg-[#FF3333]/30 text-[#FF3333] border border-[#FF3333]/40 hover:border-[#FF3333] font-black text-xxs tracking-wider uppercase transition-all rounded-none cursor-pointer flex items-center justify-center gap-2"
                        >
                          <AlertTriangle className="w-4 h-4 animate-bounce" />
                          {lang === 'es' ? '💥 SIMULAR IMPACTO GRAVE / CAÍDA (PÉRDIDA DE CONOCIMIENTO)' : '💥 SIMULATE HIGH-IMPACT FALL / UNCONSCIOUS COLLAPSE'}
                        </button>
                      </div>
                    ) : (
                      /* Flashing Countdown Safeguard Notification Overlay */
                      <div className="bg-red-950/20 border-2 border-[#FF3333] p-4 flex flex-col gap-3 animate-pulse">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-6 h-6 text-[#FF3333]" />
                          <div>
                            <span className="text-xs font-black text-[#FF3333] uppercase block tracking-wider">
                              {lang === 'es' 
                                ? '⚠️ ALERTA INTERACTIVA DE INACTIVIDAD DE PROTOCOLO DE RESGUARDO' 
                                : '⚠️ ACTIVE SAFEGUARD PROTOCOL INACTIVITY ALERT'}
                            </span>
                            <span className="text-[10px] text-white/80 uppercase">
                              {lang === 'es' 
                                ? 'Se ha detectado una parada vital crítica y pérdida de movimiento.' 
                                : 'A critical vital collapse and zero mobility have been registered.'}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-black/60 p-3 border border-[#FF3333]/30">
                          <div className="flex flex-col text-center sm:text-left">
                            <span className="text-[9px] text-white/50 uppercase font-bold tracking-widest">{lang === 'es' ? 'TIEMPO LÍMITE DE RESPUESTA OPERATIVA' : 'OPERATIONAL RESPONSE TIMEOUT'}</span>
                            <span className="text-2xl font-black text-[#FF3333]">
                              {biometricCountdown} <span className="text-xs font-normal text-white/60">SEGUNDOS / SECONDS</span>
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setBiometricCountdown(null);
                              setBiometricHeartRate(72);
                              setBiometricOxygen(98);
                              setBiometricActivity('resting');
                              addSystemLog(
                                lang === 'es'
                                  ? '✅ ALERTA CANCELADA: El ciudadano ha verificado táctilmente que se encuentra bien.'
                                  : '✅ ALERT CANCELLED: The citizen has tactilely verified they are doing well.',
                                'info'
                              );
                              if (voiceGuidance) {
                                speakInstruction(
                                  lang === 'es'
                                    ? 'Alerta biométrica descartada. Señales vitales re-estabilizadas.'
                                    : 'Biometric alert dismissed. Vital signs re-stabilized.'
                                );
                              }
                            }}
                            className="w-full sm:w-auto px-6 py-2 bg-[#00FF41] hover:bg-[#00FF41]/80 text-black border-none font-black text-xs uppercase cursor-pointer tracking-widest transition-all rounded-none"
                          >
                            [ 👍 {lang === 'es' ? 'ESTOY BIEN / DESCARTAR ALERTA' : 'I AM OK / DISMISS EMERGENCY'} ]
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* MAIN SOS INTERACTIVE REGION */}
              {(() => {
                const activeReport = reports.find(r => r.id === activeCitizenReportId);
                const assignedUnit = activeReport?.status === 'dispatched' 
                  ? units.find(u => u.id === activeReport.assignedUnitId)
                  : null;

                if (!activeReport || activeReport.status === 'resolved') {
                  return (
                    <div className="flex flex-col gap-6">
                      
                      {/* WARNING ACCESSIBILITY WARNING */}
                      <div className="bg-[#FF3333]/5 border border-[#FF3333]/20 p-4 text-center text-xxs text-white/80 uppercase leading-relaxed">
                        ⚠️ EN UN ACCIDENTE, NO PIERDA TIEMPO CALCULANDO COORDENADAS. NUESTRO ALGORITMO INTEGRADO TRANSMITIRÁ SU GEOLOCALIZACIÓN SATELITAL EXACTA AL INSTANTE EN QUE PRESIONE CUALQUIER BOTÓN.
                      </div>

                      {/* MULTI-VEHICLE CO-DEPLOYMENT CONFIGURATION */}
                      <div className="bg-black border border-white/10 p-4 rounded-none flex flex-col gap-3">
                        <span className="text-[10px] text-white/50 font-black uppercase tracking-wider block font-mono">
                          // {lang === 'es' ? 'SOLICITAR RECURSOS ADICIONALES (OPCIONAL):' : 'REQUEST ADDITIONAL CO-DEPLOYMENT (OPTIONAL):'}
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                          <button
                            type="button"
                            onClick={() => setCitizenRequestVehicles(prev => ({ ...prev, fire_truck: !prev.fire_truck }))}
                            className={`p-2.5 border text-xxs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-none ${
                              citizenRequestVehicles.fire_truck
                                ? 'bg-[#FF3333]/20 border-[#FF3333] text-[#FF3333] shadow-[0_0_10px_rgba(255,51,51,0.15)] font-bold'
                                : 'bg-stone-950/80 border-white/10 text-white/40 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            <span>🚒</span>
                            <span>{lang === 'es' ? 'BOMBEROS' : 'FIRE ENGINE'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCitizenRequestVehicles(prev => ({ ...prev, ambulance: !prev.ambulance }))}
                            className={`p-2.5 border text-xxs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-none ${
                              citizenRequestVehicles.ambulance
                                ? 'bg-[#00FF41]/20 border-[#00FF41] text-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.15)] font-bold'
                                : 'bg-stone-950/80 border-white/10 text-white/40 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            <span>🚑</span>
                            <span>{lang === 'es' ? 'AMBULANCIA' : 'AMBULANCE'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCitizenRequestVehicles(prev => ({ ...prev, heavy_rescue: !prev.heavy_rescue }))}
                            className={`p-2.5 border text-xxs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-none ${
                              citizenRequestVehicles.heavy_rescue
                                ? 'bg-[#FFD700]/20 border-[#FFD700] text-[#FFD700] shadow-[0_0_10px_rgba(255,215,0,0.15)] font-bold'
                                : 'bg-stone-950/80 border-white/10 text-white/40 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            <span>🚛</span>
                            <span>{lang === 'es' ? 'RESCATE P.' : 'HEAVY RESCUE'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCitizenRequestVehicles(prev => ({ ...prev, hazmat: !prev.hazmat }))}
                            className={`p-2.5 border text-xxs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 rounded-none ${
                              citizenRequestVehicles.hazmat
                                ? 'bg-[#a855f7]/20 border-[#a855f7] text-[#a855f7] shadow-[0_0_10px_rgba(168,85,247,0.15)] font-bold'
                                : 'bg-stone-950/80 border-white/10 text-white/40 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            <span>☣️</span>
                            <span>{lang === 'es' ? 'HAZMAT' : 'HAZMAT'}</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-white/40 leading-normal uppercase">
                          {lang === 'es'
                            ? '* Al activar múltiples íconos, su reporte SOS se transmitirá requiriendo el despacho simultáneo de todas las especialidades seleccionadas.'
                            : '* By activating multiple icons, your SOS report will broadcast requesting simultaneous dispatch of all selected specialties.'}
                        </p>
                      </div>

                      {/* SHATTERED / HIGH STRESS BUTTON GRID */}
                      <div className={`grid ${shatteredScreenMode ? 'grid-cols-1 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-4'}`}>
                        
                        {/* RED: INCENDIO */}
                        <button
                          onClick={() => handleCitizenSOS('fire')}
                          className={`group border-2 transition-all flex flex-col justify-center items-center text-center cursor-pointer ${
                            shatteredScreenMode 
                              ? 'bg-[#FF3333] border-[#FF3333] hover:bg-[#FF3333]/80 p-12 text-black font-black' 
                              : 'bg-black border-[#FF3333]/40 hover:border-[#FF3333] hover:bg-[#FF3333]/5 p-8 text-white'
                          }`}
                        >
                          <Flame className={`w-12 h-12 mb-3 group-hover:scale-110 transition-transform ${shatteredScreenMode ? 'text-black' : 'text-[#FF3333]'}`} />
                          <span className={`uppercase font-black tracking-wider ${shatteredScreenMode ? 'text-2xl' : 'text-sm'}`}>
                            🔥 INCENDIO / EXP.
                          </span>
                          {!shatteredScreenMode && (
                            <span className="text-[10px] text-white/60 mt-1 uppercase">Fuego estructural, corto circuito, flama</span>
                          )}
                        </button>

                        {/* BLUE: MEDICAL */}
                        <button
                          onClick={() => handleCitizenSOS('medical')}
                          className={`group border-2 transition-all flex flex-col justify-center items-center text-center cursor-pointer ${
                            shatteredScreenMode 
                              ? 'bg-[#3b82f6] border-[#3b82f6] hover:bg-[#3b82f6]/80 p-12 text-black font-black' 
                              : 'bg-black border-[#3b82f6]/40 hover:border-[#3b82f6] hover:bg-[#3b82f6]/5 p-8 text-white'
                          }`}
                        >
                          <Heart className={`w-12 h-12 mb-3 group-hover:scale-110 transition-transform ${shatteredScreenMode ? 'text-black' : 'text-[#3b82f6]'}`} />
                          <span className={`uppercase font-black tracking-wider ${shatteredScreenMode ? 'text-2xl' : 'text-sm'}`}>
                            🩺 HERIDO / SALUD
                          </span>
                          {!shatteredScreenMode && (
                            <span className="text-[10px] text-white/60 mt-1 uppercase">Hemorragias, paro cardiaco, atrapamiento</span>
                          )}
                        </button>

                        {/* YELLOW: CHEMICAL */}
                        <button
                          onClick={() => handleCitizenSOS('chemical')}
                          className={`group border-2 transition-all flex flex-col justify-center items-center text-center cursor-pointer ${
                            shatteredScreenMode 
                              ? 'bg-[#FFD700] border-[#FFD700] hover:bg-[#FFD700]/80 p-12 text-black font-black' 
                              : 'bg-black border-[#FFD700]/40 hover:border-[#FFD700] hover:bg-[#FFD700]/5 p-8 text-white'
                          }`}
                        >
                          <Biohazard className={`w-12 h-12 mb-3 group-hover:scale-110 transition-transform ${shatteredScreenMode ? 'text-black' : 'text-[#FFD700]'}`} />
                          <span className={`uppercase font-black tracking-wider ${shatteredScreenMode ? 'text-2xl' : 'text-sm'}`}>
                            ☣️ AMENAZA QUÍMICA
                          </span>
                          {!shatteredScreenMode && (
                            <span className="text-[10px] text-white/60 mt-1 uppercase">Fugas de gas, reactivos químicos, vapores nocivos</span>
                          )}
                        </button>

                        {/* PURPLE: LANDSLIDE */}
                        <button
                          onClick={() => handleCitizenSOS('landslide')}
                          className={`group border-2 transition-all flex flex-col justify-center items-center text-center cursor-pointer ${
                            shatteredScreenMode 
                              ? 'bg-[#a855f7] border-[#a855f7] hover:bg-[#a855f7]/80 p-12 text-black font-black' 
                              : 'bg-black border-[#a855f7]/40 hover:border-[#a855f7] hover:bg-[#a855f7]/5 p-8 text-white'
                          }`}
                        >
                          <AlertTriangle className={`w-12 h-12 mb-3 group-hover:scale-110 transition-transform ${shatteredScreenMode ? 'text-black' : 'text-[#a855f7]'}`} />
                          <span className={`uppercase font-black tracking-wider ${shatteredScreenMode ? 'text-2xl' : 'text-sm'}`}>
                            ⚠️ DERRUMBE / COLAPSO
                          </span>
                          {!shatteredScreenMode && (
                            <span className="text-[10px] text-white/60 mt-1 uppercase">Estructuras fisuradas, deslaves, atrapado bajo tierra</span>
                          )}
                        </button>

                      </div>

                      {/* OPTIONAL COMMENTS FIELD - ONLY SHOWS IN NON-SHATTERED SCREEN MODE */}
                      {!shatteredScreenMode && (
                        <div className="bg-[#0a0a0a] border border-white/10 p-4 flex flex-col gap-3">
                          <div>
                            <span className="text-xxs text-white/50 font-bold uppercase block mb-1">
                              // DETALLES ADICIONALES (OPCIONAL):
                            </span>
                            <input
                              type="text"
                              placeholder="Ej. Piso 4, hay humo denso, 2 personas adultas..."
                              value={citizenCustomComment}
                              onChange={(e) => setCitizenCustomComment(e.target.value)}
                              className="w-full bg-black border border-white/20 p-2.5 text-xs text-white focus:outline-none focus:border-[#FF3333]"
                            />
                          </div>
                          <span className="text-[9px] text-white/40 uppercase">
                            * NO SE PREOCUPE por escribir si está en peligro inminente. El sistema enviará su reporte de un solo click de forma inmediata.
                          </span>
                        </div>
                      )}

                    </div>
                  );
                }

                return (
                  /* ==========================================
                     ACTIVE EMERGENCY SOS RESCUE TRACKING RADAR
                     ========================================== */
                  <div className="bg-black border-2 border-[#FF3333] p-6 shadow-[0_0_25px_rgba(255,51,51,0.25)] flex flex-col gap-6 text-center">
                    
                    <div className="flex flex-col items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#FF3333] animate-ping" />
                      <h3 className="text-[#FF3333] text-2xl font-black uppercase tracking-wider">
                        AYUDA EN PROGRESO // SOS_TRANSMITTED
                      </h3>
                      <p className="text-xxs text-white/60 uppercase">
                        Transmisión Satelital Activa - No cierre esta ventana
                      </p>
                    </div>

                    {/* REAL-TIME PROGRESS STATUS */}
                    <div className="bg-[#0a0a0a] border border-[#FF3333]/30 p-4 flex flex-col gap-4 text-left">
                      <div className="flex justify-between items-center border-b border-[#FF3333]/15 pb-2">
                        <span className="text-xxs text-white/50 uppercase font-bold">Estado del Despacho:</span>
                        <span className={`text-xs font-black uppercase px-2 py-0.5 ${activeReport.status === 'dispatched' ? 'bg-[#00FF41]/10 text-[#00FF41]' : 'bg-[#FFD700]/10 text-[#FFD700]'}`}>
                          {activeReport.status === 'dispatched' ? '🚨 VEHÍCULO EN RUTA' : '🛰️ EN COLA DE PRIORIDAD SATELITAL'}
                        </span>
                      </div>

                      <div className="text-xs text-white/80 leading-relaxed uppercase">
                        <span className="text-white/40 font-bold">Resumen Alerta:</span> {activeReport.description}
                      </div>

                      {/* ASSIGNED UNIT TELEMETRY FEED */}
                      {activeReport.status === 'dispatched' && assignedUnit ? (
                        <div className="bg-black p-3.5 border-2 border-[#00FF41]/40 flex flex-col gap-3 mt-1.5 animate-pulse">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Shield className="w-5 h-5 text-[#00FF41]" />
                              <div>
                                <span className="text-[#00FF41] font-black text-xs block uppercase">
                                  // RESPONDEDOR: {assignedUnit.name}
                                </span>
                                <span className="text-[9px] text-white/50 block">
                                  SISTEMA INTERNO DE TRASLADO MÓVIL (SOAE)
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <span className="text-[9px] text-white/40 block">COMBUSTIBLE / ENERGÍA</span>
                              <span className="text-xs font-bold text-[#00FF41]">
                                {assignedUnit.batteryOrFuel.toFixed(0)}%
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xxs border-t border-[#00FF41]/20 pt-2 font-mono">
                            <div>
                              Distancia: <span className="text-[#00FF41] font-black block text-sm">
                                {citizenCoords
                                  ? getHaversineDistance(
                                      citizenCoords.lat,
                                      citizenCoords.lon,
                                      assignedUnit.lat,
                                      assignedUnit.lon
                                    ).toFixed(2)
                                  : 'Calculando...'} km
                              </span>
                            </div>
                            <div>
                              Velocidad: <span className="text-white font-bold block text-sm">
                                {assignedUnit.speed.toFixed(0)} km/h
                              </span>
                            </div>
                            <div className="text-right">
                              Estatus: <span className="text-white font-bold block text-sm uppercase">
                                {assignedUnit.status}
                              </span>
                            </div>
                          </div>

                          {/* Interactive Proximity Bar */}
                          <div className="w-full bg-[#111111] h-1.5 border border-[#00FF41]/20 overflow-hidden relative">
                            <div 
                              className="h-full bg-[#00FF41]" 
                              style={{ 
                                width: `${Math.max(10, Math.min(100, 100 - (citizenCoords ? getHaversineDistance(citizenCoords.lat, citizenCoords.lon, assignedUnit.lat, assignedUnit.lon) : 5) * 20))}%` 
                              }} 
                            />
                          </div>

                          <span className="text-[9px] text-[#00FF41]/80 text-center block uppercase font-bold">
                            🔊 Manténgase visible: La unidad se está aproximando en tiempo real.
                          </span>
                        </div>
                      ) : (
                        <div className="bg-black p-4 border border-[#FFD700]/30 text-center animate-pulse">
                          <span className="text-[#FFD700] font-bold text-xxs block uppercase">
                            ⚡ ASIGNANDO DE ACUERDO A OPTIMIZACIÓN MILP...
                          </span>
                          <p className="text-[9px] text-white/50 mt-1 uppercase">
                            El motor de prioridad analiza el camión de bomberos o ambulancia ideal para reducir el tiempo de respuesta.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* CONTEXT-SENSITIVE SURVIVAL MANUALS */}
                    <div className="bg-[#0a0a0a] border border-white/15 p-4 text-left flex flex-col gap-2">
                      <span className="text-xs font-bold text-[#FF3333] block border-b border-white/10 pb-1.5 uppercase tracking-wider">
                        📋 PROTOCOLO DE AUTOPROTECCIÓN Y SUPERVIVENCIA:
                      </span>
                      
                      <ul className="text-xxs text-white/80 list-disc list-inside space-y-2 uppercase leading-relaxed font-semibold">
                        {activeReport.type === 'fire' && (
                          <>
                            <li>Permanezca lo más cerca posible del suelo para evitar respirar gases calientes y humo letal.</li>
                            <li>Cubra su nariz y boca con un paño húmedo o cualquier prenda textil para filtrar partículas.</li>
                            <li>No intente abrir puertas calientes con la mano descubierta; verifique la temperatura primero.</li>
                            <li>NUNCA use elevadores bajo ninguna circunstancia. Use escaleras con pasamanos táctiles.</li>
                          </>
                        )}
                        {activeReport.type === 'medical' && (
                          <>
                            <li>Mantenga la calma, siéntese en el suelo y regule su respiración de forma consciente.</li>
                            <li>Si presenta sangrado activo, presione la herida firmemente con un trapo limpio.</li>
                            <li>No intente caminar ni realizar movimientos bruscos que eleven el pulso cardiaco.</li>
                            <li>Si está en un lugar cerrado, encienda la linterna del celular para guiar a los rescatistas.</li>
                          </>
                        )}
                        {activeReport.type === 'chemical' && (
                          <>
                            <li>Identifique la dirección del viento y desplácese de inmediato en dirección opuesta (a barlovento).</li>
                            <li>Cubra totalmente su piel y ojos. Busque áreas elevadas; los gases nocivos suelen ser más densos.</li>
                            <li>Si se encuentra bajo techo, selle las rendijas de puertas y ventanas con telas mojadas.</li>
                            <li>Evite encender cerillos, encendedores o cualquier interruptor eléctrico que pueda gatillar chispas.</li>
                          </>
                        )}
                        {activeReport.type === 'landslide' && (
                          <>
                            <li>Busque una zona segura adyacente a un pilar estructural para formar un triángulo de supervivencia.</li>
                            <li>Evite gritar continuamente para ahorrar oxígeno y no tragar polvo.</li>
                            <li>Si está inmovilizado, golpee tuberías o estructuras metálicas rítmicamente cada 2 minutos.</li>
                            <li>Proteja su cráneo y cervicales cruzando los brazos sobre la nuca firmemente.</li>
                          </>
                        )}
                      </ul>
                    </div>

                    {/* DOUBLE CONFIRMATION CANCEL BUTTON (to prevent accidental cancel) */}
                    <div className="bg-[#0a0a0a] border border-white/10 p-4 flex flex-col gap-3">
                      <p className="text-[10px] text-white/50 uppercase">
                        ¿Fue una falsa alarma o el peligro cesó por completo?
                      </p>
                      <button
                        onDoubleClick={() => {
                          if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
                          
                          // Report emergency resolved / cancelled
                          const resolvedReport = { ...activeReport, status: 'resolved' };
                          socketRef.current.send(JSON.stringify({
                            type: 'emergency_updated',
                            payload: resolvedReport,
                            isSimulation: false
                          }));

                          setActiveCitizenReportId(null);
                          addSystemLog('★ SOS Ciudadano cancelado por el usuario.', 'info');
                          speakInstruction("Emergencia cancelada con éxito. Regresando al portal de reporte.");
                        }}
                        className="w-full py-3 bg-[#FFD700] text-black font-black uppercase text-xs hover:bg-[#FFD700]/80 rounded-none cursor-pointer border border-[#FFD700]"
                      >
                        [ ⚠️ HACER DOBLE-CLICK PARA CANCELAR AUXILIO ]
                      </button>
                      <span className="text-[9px] text-white/40 block uppercase font-mono">
                        * Doble-click para evitar que una pantalla rota cancele el reporte de forma involuntaria
                      </span>
                    </div>

                  </div>
                );
              })()}

            </div>
          </div>
        )}

          </>
        )}

      </div>

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 text-white font-mono">
          <div className="w-full max-w-lg bg-[#0a0a0a] border-2 border-[#00FF41] p-6 shadow-[0_0_30px_rgba(0,255,65,0.2)]">
            <div className="flex justify-between items-center border-b border-[#00FF41]/30 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#00FF41] animate-spin-slow" />
                <h3 className="text-sm font-black uppercase tracking-widest text-[#00FF41]">
                  {lang === 'es' ? 'SOAE // CONFIGURACIÓN DE SISTEMA' : 'SOAE // SYSTEM SETTINGS'}
                </h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-[#00FF41]/60 hover:text-[#00FF41] font-bold text-xs cursor-pointer border-none bg-transparent"
              >
                [X] {lang === 'es' ? 'CERRAR' : 'CLOSE'}
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-0.5 mb-5 border-b border-[#00FF41]/20 pb-3">
              {(['system', 'audio', 'privacy', 'location', 'stations', 'github'] as const).map((tab) => {
                let icon = null;
                let label = '';
                if (tab === 'system') {
                  icon = <Cpu className="w-3.5 h-3.5" />;
                  label = lang === 'es' ? 'SISTEMA' : 'SYSTEM';
                } else if (tab === 'audio') {
                  icon = <Volume2 className="w-3.5 h-3.5" />;
                  label = lang === 'es' ? 'AUDIO' : 'AUDIO';
                } else if (tab === 'privacy') {
                  icon = <Shield className="w-3.5 h-3.5" />;
                  label = lang === 'es' ? 'PRIVACIDAD' : 'PRIVACY';
                } else if (tab === 'location') {
                  icon = <MapPin className="w-3.5 h-3.5" />;
                  label = lang === 'es' ? 'UBICACIÓN' : 'LOCATION';
                } else if (tab === 'stations') {
                  icon = <Building className="w-3.5 h-3.5" />;
                  label = lang === 'es' ? 'ESTACIONES' : 'STATIONS';
                } else if (tab === 'github') {
                  icon = <Github className="w-3.5 h-3.5" />;
                  label = lang === 'es' ? 'GITHUB / EXPORT' : 'GITHUB / EXPORT';
                }

                return (
                  <button
                    key={tab}
                    onClick={() => setSettingsActiveTab(tab)}
                    className={`py-2 px-1 text-[8px] sm:text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border flex flex-col sm:flex-row items-center justify-center gap-1.5 ${
                      settingsActiveTab === tab
                        ? 'bg-[#00FF41]/20 border-[#00FF41] text-[#00FF41] shadow-[0_0_10px_rgba(0,255,65,0.1)]'
                        : 'bg-stone-950 border-[#00FF41]/10 text-[#00FF41]/40 hover:text-[#00FF41]/75 hover:border-[#00FF41]/30'
                    }`}
                  >
                    {icon}
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT CONTAINER */}
            <div className="flex flex-col gap-4 min-h-[220px] justify-between">
              
              <div>
                {/* SYSTEM TAB */}
                {settingsActiveTab === 'system' && (
                  <div className="flex flex-col gap-4">
                    {/* INTERFACE LANGUAGE */}
                    <div className="flex flex-col gap-2 bg-black/40 p-3 border border-[#00FF41]/10">
                      <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'IDIOMA DE LA INTERFAZ' : 'INTERFACE LANGUAGE'}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setLang('es');
                            if (voiceGuidance) speakInstruction('Idioma cambiado a español.', 'es');
                          }}
                          className={`py-2 text-xxs font-black transition-all cursor-pointer border ${
                            lang === 'es'
                              ? 'bg-[#00FF41]/20 border-[#00FF41] text-white shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                              : 'bg-stone-950 border-[#00FF41]/10 text-[#00FF41]/50 hover:border-[#00FF41]'
                          }`}
                        >
                          CASTELLANO (ES)
                        </button>
                        <button
                          onClick={() => {
                            setLang('en');
                            if (voiceGuidance) speakInstruction('Language changed to English.', 'en');
                          }}
                          className={`py-2 text-xxs font-black transition-all cursor-pointer border ${
                            lang === 'en'
                              ? 'bg-[#00FF41]/20 border-[#00FF41] text-white shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                              : 'bg-stone-950 border-[#00FF41]/10 text-[#00FF41]/50 hover:border-[#00FF41]'
                          }`}
                        >
                          ENGLISH (EN)
                        </button>
                      </div>
                    </div>

                    {/* VISUAL THEME SELECTION */}
                    <div className="flex flex-col gap-2 bg-black/40 p-3 border border-[#00FF41]/10">
                      <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'TEMA DE DISEÑO VISUAL' : 'VISUAL DESIGN THEME'}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setAppTheme('cyberpunk');
                            localStorage.setItem('soae_theme', 'cyberpunk');
                            addSystemLog(
                              lang === 'es'
                                ? 'SISTEMA: Tema visual cambiado a Terminal Cyberpunk.'
                                : 'SYSTEM: Visual theme changed to Terminal Cyberpunk.',
                              'info'
                            );
                            if (voiceGuidance) speakInstruction(lang === 'es' ? 'Tema cyberpunk activado.' : 'Cyberpunk theme activated.', lang);
                          }}
                          className={`py-2 text-xxs font-black transition-all cursor-pointer border ${
                            appTheme === 'cyberpunk'
                              ? 'bg-[#00FF41]/20 border-[#00FF41] text-white shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                              : 'bg-stone-950 border-[#00FF41]/10 text-[#00FF41]/50 hover:border-[#00FF41]'
                          }`}
                        >
                          CYBERPUNK NEON
                        </button>
                        <button
                          onClick={() => {
                            setAppTheme('light');
                            localStorage.setItem('soae_theme', 'light');
                            addSystemLog(
                              lang === 'es'
                                ? 'SISTEMA: Tema visual cambiado a Firestore Light.'
                                : 'SYSTEM: Visual theme changed to Firestore Light.',
                              'info'
                            );
                            if (voiceGuidance) speakInstruction(lang === 'es' ? 'Tema claro de firestore activado.' : 'Firestore light theme activated.', lang);
                          }}
                          className={`py-2 text-xxs font-black transition-all cursor-pointer border ${
                            appTheme === 'light'
                              ? 'bg-[#00FF41]/20 border-[#00FF41] text-white shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                              : 'bg-stone-950 border-[#00FF41]/10 text-[#00FF41]/50 hover:border-[#00FF41]'
                          }`}
                        >
                          FIRESTORE LIGHT
                        </button>
                      </div>
                    </div>

                    {/* ACCESSIBILITY: HIGH CONTRAST MODE */}
                    <div className="flex flex-col gap-2 bg-black/40 p-3 border border-[#00FF41]/10">
                      <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'ACCESIBILIDAD Y CONTRASTE' : 'ACCESSIBILITY & CONTRAST'}
                      </span>
                      <div className="flex justify-between items-center bg-stone-950 p-2.5 border border-[#00FF41]/20">
                        <div className="flex items-center gap-2">
                          <Eye className={`w-4 h-4 ${highContrast ? 'text-[#00FF41]' : 'text-[#00FF41]/50'}`} />
                          <span className="text-[10px] text-white/75 font-bold">
                            {lang === 'es' ? 'Modo de Contraste Alto' : 'High Contrast Mode'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const next = !highContrast;
                            setHighContrast(next);
                            addSystemLog(
                              lang === 'es'
                                ? `INTERFAZ: Modo de alto contraste ${next ? 'ACTIVADO' : 'DESACTIVADO'}.`
                                : `INTERFACE: High contrast mode ${next ? 'ACTIVATED' : 'DEACTIVATED'}.`,
                              'info'
                            );
                            if (voiceGuidance) {
                              speakInstruction(
                                lang === 'es'
                                  ? `Contraste alto ${next ? 'activado' : 'desactivado'}.`
                                  : `High contrast ${next ? 'activated' : 'deactivated'}.`,
                                lang
                              );
                            }
                          }}
                          className={`px-4 py-1.5 border font-black transition-all cursor-pointer rounded-none text-xxs ${
                            highContrast
                              ? 'bg-[#00FF41]/20 border-[#00FF41] text-white shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                              : 'bg-black border-[#00FF41]/10 text-[#00FF41]/40 hover:border-[#00FF41]/30 hover:text-[#00FF41]/70'
                          }`}
                        >
                          {highContrast ? (lang === 'es' ? 'ACTIVO' : 'ACTIVE') : (lang === 'es' ? 'INACTIVO' : 'INACTIVE')}
                        </button>
                      </div>
                    </div>

                    {/* METADATA TIMESTAMPS */}
                    <div className="grid grid-cols-2 gap-2 text-[9px] text-[#00FF41]/50 bg-black/40 p-3 border border-[#00FF41]/10 uppercase">
                      <div className="flex flex-col">
                        <span>{lang === 'es' ? 'Hora Local:' : 'Local Time:'}</span>
                        <span className="text-white font-bold">{new Date().toLocaleTimeString()}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span>{lang === 'es' ? 'Fecha Operativa:' : 'Operational Date:'}</span>
                        <span className="text-white font-bold">{new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* AUDIO TAB */}
                {settingsActiveTab === 'audio' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 bg-black/40 p-3 border border-[#00FF41]/10">
                      <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'GUÍA POR VOZ RECEPTIVA' : 'RECEPTIVE VOICE ANNOUNCEMENTS'}
                      </span>
                      <div className="flex flex-col gap-3 bg-stone-950 p-3 border border-[#00FF41]/20">
                        <span className="text-xxs text-white/75 leading-relaxed">
                          {lang === 'es'
                            ? 'Activa los anuncios hablados de despacho y telemetría por voz sintetizada en tiempo real.'
                            : 'Enable real-time synthesized voice dispatch and telemetry verbal announcements.'}
                        </span>
                        <button
                          onClick={() => {
                            const next = !voiceGuidance;
                            setVoiceGuidance(next);
                            if (next) {
                              speakInstruction(
                                lang === 'es'
                                  ? 'Guía de voz del mando central activada.'
                                  : 'Central command voice guidance activated.'
                              );
                            } else {
                              if ('speechSynthesis' in window) {
                                window.speechSynthesis.cancel();
                              }
                            }
                          }}
                          className={`w-full py-2 border font-black transition-all cursor-pointer rounded-none text-xxs ${
                            voiceGuidance
                              ? 'bg-[#00FF41]/20 border-[#00FF41] text-white shadow-[0_0_8px_rgba(0,255,65,0.15)]'
                              : 'bg-black border-[#00FF41]/10 text-[#00FF41]/40'
                          }`}
                        >
                          {voiceGuidance ? (lang === 'es' ? 'SINTETIZADOR: ACTIVO' : 'SYNTHESIZER: ACTIVE') : (lang === 'es' ? 'SINTETIZADOR: SILENCIADO' : 'SYNTHESIZER: MUTED')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* PRIVACY TAB */}
                {settingsActiveTab === 'privacy' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 bg-black/40 p-3 border border-[#00FF41]/10">
                      <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'MONITOREO BIOMÉTRICO CONTINUO' : 'CONTINUOUS BIOMETRIC MONITORING'}
                      </span>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-2.5 bg-stone-950 p-2.5 border border-[#00FF41]/20">
                          <input
                            type="checkbox"
                            id="consent-checkbox-modal"
                            checked={biometricConsent}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setBiometricConsent(next);
                              if (!next) {
                                setBiometricCountdown(null);
                              }
                              addSystemLog(
                                lang === 'es'
                                  ? `TELEMETRÍA: Monitoreo biométrico continuo ${next ? 'AUTORIZADO por consentimiento' : 'DESACTIVADO por el usuario'}.`
                                  : `TELEMETRY: Continuous biometric monitoring ${next ? 'AUTHORIZED by user consent' : 'DISABLED by user'}.`,
                                next ? 'info' : 'warning'
                              );
                            }}
                            className="mt-1 w-4 h-4 accent-[#00FF41] cursor-pointer rounded-none border border-[#00FF41]/30 bg-black"
                          />
                          <label htmlFor="consent-checkbox-modal" className="text-xxs text-white/70 leading-relaxed cursor-pointer select-none">
                            <strong className="text-white font-bold block mb-0.5">
                              {lang === 'es' ? 'CONTRATO DE CONSENTIMIENTO EXPRESO:' : 'EXPRESS PRIVACY CONSENT AGREEMENT:'}
                            </strong>
                            {lang === 'es'
                              ? 'Autorizo a SOAE a leer continuamente mis señales biométricas (ritmo cardíaco, acelerómetro de caída) de fondo. Entiendo que en caso de detectar un impacto severo o paro vital, y no responder en 10s al resguardo, el sistema generará y despachará auxilio satelital autónomo inmediato.'
                              : 'I authorize SOAE to continuously monitor my background biometric signals (heart rate, fall-detection accelerometer). I understand that in case of high-impact deceleration or vital crash, and not responding in 10s, the system will autonomously broadcast and dispatch immediate satellite emergency responders.'}
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* LOCATION TAB */}
                {settingsActiveTab === 'location' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 bg-black/40 p-3 border border-[#00FF41]/10">
                      <span className="text-[10px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'CENTRO OPERATIVO Y GEOLOCALIZACIÓN' : 'OPERATIONAL BASE & GEOLOCATION'}
                      </span>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 bg-stone-950 border border-[#00FF41]/20 px-2.5 py-2 text-xxs">
                          <MapPin className="w-3.5 h-3.5 text-[#00FF41]" />
                          <span className="text-[#00FF41]/50 font-bold uppercase mr-1">{lang === 'es' ? 'REGIÓN:' : 'REGION:'}</span>
                          <select
                            value={
                              currentRegion.regionName === 'Ubicación Local' || 
                              currentRegion.regionName === 'Local Position' || 
                              currentRegion.regionName === 'Autodetect by GPS' || 
                              currentRegion.regionName === 'Autodetectar por GPS'
                                ? 'autodetect'
                                : `${currentRegion.lat},${currentRegion.lon}`
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === 'autodetect') {
                                handleAutodetectRegion();
                              } else {
                                const [latStr, lonStr] = val.split(',');
                                const lat = parseFloat(latStr);
                                const lon = parseFloat(lonStr);
                                const selectedOption = e.target.options[e.target.selectedIndex];
                                const label = selectedOption.getAttribute('data-label') || '';
                                handleChangeRegion(lat, lon, label);
                              }
                            }}
                            className="bg-transparent text-[#00FF41] hover:text-white font-black font-mono transition-all focus:outline-none cursor-pointer border-none flex-1"
                          >
                            <option value="autodetect" data-label="GPS Autodetect" className="bg-[#050505] text-[#00FF41]">🛰️ {lang === 'es' ? 'Autodetectar por GPS' : 'Autodetect by GPS'}</option>
                            {currentRegion.regionName !== 'México DF' &&
                             currentRegion.regionName !== 'Caracas (VZLA)' &&
                             currentRegion.regionName !== 'CDMX (MEX)' &&
                             currentRegion.regionName !== 'CDMX (MÉXICO)' &&
                             currentRegion.regionName !== 'México D.F.' &&
                             currentRegion.regionName !== 'Bogotá (COL)' &&
                             currentRegion.regionName !== 'Madrid (ESP)' &&
                             currentRegion.regionName !== 'Ubicación Local' &&
                             currentRegion.regionName !== 'Local Position' &&
                             currentRegion.regionName !== 'Autodetect by GPS' &&
                             currentRegion.regionName !== 'Autodetectar por GPS' && (
                              <option value={`${currentRegion.lat},${currentRegion.lon}`} data-label={currentRegion.regionName} className="bg-[#050505] text-[#00FF41]">
                                {currentRegion.regionName}
                              </option>
                            )}
                            <option value="19.4326,-99.1332" data-label="CDMX (MEX)" className="bg-[#050505] text-[#00FF41]">CDMX, México</option>
                            <option value="40.4168,-3.7038" data-label="Madrid (ESP)" className="bg-[#050505] text-[#00FF41]">Madrid, España</option>
                            <option value="4.7110,-74.0721" data-label="Bogotá (COL)" className="bg-[#050505] text-[#00FF41]">Bogotá, Colombia</option>
                            <option value="10.4806,-66.9036" data-label="Caracas (VZLA)" className="bg-[#050505] text-[#00FF41]">Caracas, Venezuela</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STATIONS TAB */}
                {settingsActiveTab === 'stations' && (
                  <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1">
                    <div className="bg-black/40 p-3 border border-[#00FF41]/10 flex flex-col gap-1">
                      <span className="text-[9px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'INFORMACIÓN REQUERIDA PARA MAPEO TÁCTICO' : 'TACTICAL MAP INTEGRATION REQUIREMENTS'}
                      </span>
                      <p className="text-[9px] text-white/70 leading-relaxed uppercase font-sans">
                        {lang === 'es'
                          ? 'Para registrar una estación de respuesta en el minimapa interactivo y habilitar el ruteo dinámico de cobertura, se requiere un nombre operativo, coordenadas GPS de despliegue, estimación de riesgo base, densidad poblacional regional (para cálculo de RVI/IVR) y los vehículos tácticos estacionados.'
                          : 'To plot a tactical response station on the interactive minimap and enable dynamic coverage routing, the system requires an operational callsign, deployment GPS coordinates, estimated base risk, population density (for RVI/IVR calculation), and local stationed responder vehicles.'}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 bg-black/40 p-3 border border-[#00FF41]/10">
                      <span className="text-[9px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'REGISTRO DE NUEVA ESTACIÓN BASE' : 'NEW BASE STATION REGISTRATION'}
                      </span>
                      
                      <div className="flex flex-col gap-2.5">
                        {/* Name input */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] text-white/50 font-bold uppercase">{lang === 'es' ? 'Identificativo / Nombre:' : 'Base Callsign / Name:'}</label>
                          <input
                            type="text"
                            value={stationFormName}
                            onChange={(e) => setStationFormName(e.target.value)}
                            placeholder={lang === 'es' ? 'e.g. Estación Caracas Central' : 'e.g. Caracas Central Station'}
                            className="bg-black border border-[#00FF41]/20 p-2 text-xxs text-[#00FF41] font-mono focus:outline-none focus:border-[#00FF41] uppercase"
                          />
                        </div>

                        {/* Coordinates */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-white/50 font-bold uppercase">{lang === 'es' ? 'Latitud (Y):' : 'Latitude (Y):'}</label>
                            <input
                              type="number"
                              step="any"
                              value={stationFormLat}
                              onChange={(e) => setStationFormLat(e.target.value)}
                              placeholder="e.g. 10.4806"
                              className="bg-black border border-[#00FF41]/20 p-2 text-xxs text-[#00FF41] font-mono focus:outline-none focus:border-[#00FF41]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-white/50 font-bold uppercase">{lang === 'es' ? 'Longitud (X):' : 'Longitude (X):'}</label>
                            <input
                              type="number"
                              step="any"
                              value={stationFormLon}
                              onChange={(e) => setStationFormLon(e.target.value)}
                              placeholder="e.g. -66.9036"
                              className="bg-black border border-[#00FF41]/20 p-2 text-xxs text-[#00FF41] font-mono focus:outline-none focus:border-[#00FF41]"
                            />
                          </div>
                        </div>

                        {/* Autofill from active center */}
                        <button
                          type="button"
                          onClick={() => {
                            setStationFormLat(currentRegion.lat.toString());
                            setStationFormLon(currentRegion.lon.toString());
                          }}
                          className="text-left text-[9px] text-[#00FF41]/70 hover:text-[#00FF41] transition-all font-bold uppercase underline cursor-pointer border-none bg-transparent"
                        >
                          📍 {lang === 'es' ? 'Usar coordenadas actuales de región' : 'Use current region center coordinates'}
                        </button>

                        {/* Risk & Density */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-white/50 font-bold uppercase">{lang === 'es' ? 'Riesgo Base (0.1 - 1.0):' : 'Base Risk (0.1 - 1.0):'}</label>
                            <input
                              type="number"
                              min="0.1"
                              max="1.0"
                              step="0.05"
                              value={stationFormRisk}
                              onChange={(e) => setStationFormRisk(parseFloat(e.target.value) || 0.5)}
                              className="bg-black border border-[#00FF41]/20 p-2 text-xxs text-[#00FF41] font-mono focus:outline-none focus:border-[#00FF41]"
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] text-white/50 font-bold uppercase">{lang === 'es' ? 'Densidad Poblacional:' : 'Population Density:'}</label>
                            <input
                              type="number"
                              step="500"
                              value={stationFormDensity}
                              onChange={(e) => setStationFormDensity(parseInt(e.target.value) || 10000)}
                              className="bg-black border border-[#00FF41]/20 p-2 text-xxs text-[#00FF41] font-mono focus:outline-none focus:border-[#00FF41]"
                            />
                          </div>
                        </div>

                        {/* Initial Fleet Stationed */}
                        <div className="flex flex-col gap-1 border-t border-[#00FF41]/10 pt-2.5 mt-1">
                          <label className="text-[9px] text-white/50 font-bold uppercase mb-1">
                            🏢 {lang === 'es' ? 'Flota de Emergencia Estacionada:' : 'Stationed Emergency Fleet:'}
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <label className="flex items-center gap-1.5 bg-stone-950 p-2 border border-[#00FF41]/10 text-xxs cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={stationFormUnits.fire_truck}
                                onChange={(e) => setStationFormUnits(p => ({ ...p, fire_truck: e.target.checked }))}
                                className="accent-[#00FF41]"
                              />
                              <span>🚒 {lang === 'es' ? 'Bomberos' : 'Fire Truck'}</span>
                            </label>
                            <label className="flex items-center gap-1.5 bg-stone-950 p-2 border border-[#00FF41]/10 text-xxs cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={stationFormUnits.heavy_rescue}
                                onChange={(e) => setStationFormUnits(p => ({ ...p, heavy_rescue: e.target.checked }))}
                                className="accent-[#00FF41]"
                              />
                              <span>🛠️ {lang === 'es' ? 'Rescate Pesado' : 'Heavy Rescue'}</span>
                            </label>
                            <label className="flex items-center gap-1.5 bg-stone-950 p-2 border border-[#00FF41]/10 text-xxs cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={stationFormUnits.ambulance}
                                onChange={(e) => setStationFormUnits(p => ({ ...p, ambulance: e.target.checked }))}
                                className="accent-[#00FF41]"
                              />
                              <span>🚑 {lang === 'es' ? 'Ambulancia' : 'Ambulance'}</span>
                            </label>
                            <label className="flex items-center gap-1.5 bg-stone-950 p-2 border border-[#00FF41]/10 text-xxs cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={stationFormUnits.hazmat}
                                onChange={(e) => setStationFormUnits(p => ({ ...p, hazmat: e.target.checked }))}
                                className="accent-[#00FF41]"
                              />
                              <span>☣️ Hazmat</span>
                            </label>
                          </div>
                        </div>

                        {/* Submit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            // Validate input
                            const latNum = parseFloat(stationFormLat);
                            const lonNum = parseFloat(stationFormLon);
                            if (!stationFormName.trim()) {
                              alert(lang === 'es' ? 'Por favor ingrese un nombre para la estación.' : 'Please enter a name for the station.');
                              return;
                            }
                            if (isNaN(latNum) || isNaN(lonNum)) {
                              alert(lang === 'es' ? 'Coordenadas GPS no válidas.' : 'Invalid GPS coordinates.');
                              return;
                            }

                            // Build fleet unit list
                            const startingUnits: { name: string; type: string }[] = [];
                            if (stationFormUnits.fire_truck) startingUnits.push({ name: `BOMBA-${stationFormName.substring(0,4).toUpperCase()}`, type: 'fire_truck' });
                            if (stationFormUnits.heavy_rescue) startingUnits.push({ name: `RESCATE-${stationFormName.substring(0,4).toUpperCase()}`, type: 'heavy_rescue' });
                            if (stationFormUnits.ambulance) startingUnits.push({ name: `MED-${stationFormName.substring(0,4).toUpperCase()}`, type: 'ambulance' });
                            if (stationFormUnits.hazmat) startingUnits.push({ name: `QUIM-${stationFormName.substring(0,4).toUpperCase()}`, type: 'hazmat' });

                            // Send through WebSocket connection
                            if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
                              addSystemLog(lang === 'es' ? 'Enlace satelital fuera de línea. No se pudo registrar la base.' : 'Satellite link offline. Could not register base.', 'danger');
                              return;
                            }

                            socketRef.current.send(JSON.stringify({
                              type: 'base_station_added',
                              payload: {
                                name: stationFormName.toUpperCase(),
                                lat: latNum,
                                lon: lonNum,
                                baseRisk: stationFormRisk,
                                populationDensity: stationFormDensity,
                                units: startingUnits
                              },
                              isSimulation: activeTab === 'drill'
                            }));

                            addSystemLog(
                              lang === 'es' 
                                ? `COMANDO: Enviando solicitud de registro de base operativa ${stationFormName.toUpperCase()}...` 
                                : `COMMAND: Submitting operational registration request for base station ${stationFormName.toUpperCase()}...`, 
                              'info'
                            );

                            // Reset form fields
                            setStationFormName('');
                            setStationFormLat('');
                            setStationFormLon('');
                            setStationFormUnits({
                              fire_truck: true,
                              heavy_rescue: false,
                              ambulance: false,
                              hazmat: false,
                            });
                            
                            // Feedback voice synthesis
                            if (voiceGuidance) {
                              speakInstruction(
                                lang === 'es' 
                                  ? `Comando de instalación de base enviado.` 
                                  : `Base station deployment command submitted.`
                              );
                            }
                          }}
                          className="w-full py-2.5 mt-2 bg-[#00FF41]/20 border border-[#00FF41] hover:bg-[#00FF41] hover:text-black font-black text-xxs tracking-widest uppercase transition-all cursor-pointer rounded-none text-white text-shadow-none"
                        >
                          🚀 {lang === 'es' ? 'OPERACIONALIZAR BASE TÁCTICA' : 'OPERATIONALIZE TACTICAL BASE'}
                        </button>

                      </div>
                    </div>
                  </div>
                )}

                {/* GITHUB EXPORT TAB */}
                {settingsActiveTab === 'github' && (
                  <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1 text-white">
                    <div className="bg-black/40 p-3 border border-[#00FF41]/10 flex flex-col gap-1">
                      <span className="text-[9px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'ESTRUCTURA DE EXPORTACIÓN COMPLETA' : 'COMPLETE EXPORT STRUCTURE'}
                      </span>
                      <p className="text-[9px] text-white/70 leading-relaxed uppercase font-sans">
                        {lang === 'es'
                          ? 'El proyecto ha sido estructurado y configurado con archivos listos para GitHub. Incluye un archivo .gitignore para proteger credenciales, un README con instrucciones completas y una Licencia MIT que libera de toda responsabilidad a Google.'
                          : 'The project is pre-structured and configured with files ready for GitHub. It includes a .gitignore to secure credentials, a README with full setup instructions, and an MIT License that exempts Google from all liability.'}
                      </p>
                    </div>

                    <div className="bg-black/40 p-3 border border-[#00FF41]/10 flex flex-col gap-2">
                      <span className="text-[9px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'DESCARGAR ARCHIVOS INDIVIDUALES' : 'DOWNLOAD INDIVIDUAL FILES'}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => {
                            const gitignoreContent = "node_modules/\nbuild/\ndist/\ncoverage/\n.DS_Store\n*.log\n.env*\n!.env.example\n";
                            const blob = new Blob([gitignoreContent], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = '.gitignore';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            addSystemLog(lang === 'es' ? 'DESCARGA: Archivo .gitignore descargado.' : 'DOWNLOAD: .gitignore file downloaded.', 'info');
                          }}
                          className="py-2 bg-[#00FF41]/10 hover:bg-[#00FF41] hover:text-black text-[#00FF41] border border-[#00FF41]/30 font-black text-xxs tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          .gitignore
                        </button>
                        
                        <button
                          onClick={() => {
                            const licenseContent = `MIT License\n\nCopyright (c) 2026 SOAE Project Contributors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.\n\n--------------------------------------------------------------------------------\n⚠️ EXPLICIT DISCLAIMER & LIMITATION OF LIABILITY REGARDING GOOGLE & THIRD PARTIES\n--------------------------------------------------------------------------------\n1. INDEPENDENT WORK: This application (SOAE - Sistema de Orquestación Autónoma de Emergencias) is an independent project developed solely for educational, evaluation, and disaster preparedness simulation purposes. It is not affiliated with, sponsored by, endorsed by, or representative of Google LLC, Google Cloud, Alphabet Inc., or any of their affiliates or subsidiaries.\n\n2. AS-IS EVALUATION SANDBOX: This software is designed as a simulation and sandbox demonstration tool. It is NOT certified, verified, or guaranteed to be suitable for actual real-world emergency dispatching, first-responder coordination, high-risk civil defense, or medical response services. Under no circumstances should this application be deployed as a critical safety-of-life system in actual hazardous situations.\n\n3. GOOGLE INDEMNIFICATION: By deploying, hosting, or utilizing this software, you explicitly agree that Google (including its parents, subsidiaries, employees, partners, and technology platforms like AI Studio, Cloud Run, and Firebase) is completely exempt and free from any and all liability, claims, damages, or losses resulting from its compilation, deployment, configuration, performance, or use. Google holds absolutely no responsibility for the actions, failures, data synchronization, security vulnerabilities, or operations of this system. All operational risks are assumed entirely by the end-user or deploying organization.`;
                            const blob = new Blob([licenseContent], { type: 'text/plain;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'LICENSE';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            addSystemLog(lang === 'es' ? 'DESCARGA: Archivo LICENSE descargado.' : 'DOWNLOAD: LICENSE file downloaded.', 'info');
                          }}
                          className="py-2 bg-[#00FF41]/10 hover:bg-[#00FF41] hover:text-black text-[#00FF41] border border-[#00FF41]/30 font-black text-xxs tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          LICENSE
                        </button>
                        
                        <button
                          onClick={() => {
                            const readmeContent = `# SOAE v4.2 // Sistema de Orquestación Autónoma de Emergencias\n### *Autonomous Emergency Orchestration System*\n\nAn offline-first, real-time tactical dashboard and disaster management command center built in React, TypeScript, and Tailwind CSS. The system integrates predictive AI simulation (digital twin stress-testing), automatic IoT telemetry dispatcher orchestration, residual vulnerability analysis, and robust multi-mode local-first or Firebase cloud-synchronized states.\n\n---\n\n## 🎨 Características / Key Features\n\n- **Dynamic Theme Selector / Selector de Temas**:\n  - **Terminal Cyberpunk (Default)**: Dark tactical matrix HUD ideal for low-light command environments.\n  - **Firestore Professional Light (White Theme)**: Clean, high-contrast, modern layout styled after the Google Cloud / Firebase console for daytime command operations.\n- **Evaluation Sandbox Mode / Modo de Evaluación**:\n  - Access the complete system instantly without requiring pre-configured passwords, databases, or Firebase permissions. Perfect for classroom demonstrations, evaluations, and mock operations.\n- **Bilingual Receptive Interface / Interfaz Bilingüe**:\n  - Full support for both Spanish and English commands, HUD interfaces, alerts, and real-time synthesized audio announcements.\n- **Residual Vulnerability Index (IVR / RVI)**:\n  - Real-time sector-by-sector risk assessments factoring in population density, localized incidents, and rescue unit dispatch travel times (ETA).\n- **Digital Twin & Stochastic Stress-Testing**:\n  - Predictive simulation engine to stress-test city infrastructure, roads, and emergency response capabilities under major disasters (Earthquakes, Floods, Wildfires).\n- **Tactical Map (GIS Integration)**:\n  - Interactive map canvas supporting hazard area routing, obstacle avoidance, automatic dispatch recommendation triggers, and manual station deployment.\n\n---\n\n## 🚀 Instalación y Uso Local / Installation & Local Setup\n\n### Prerrequisitos / Prerequisites\n- [Node.js](https://nodejs.org/) (v18+)\n- npm (v9+)\n\n### Pasos / Setup Steps\n1. **Clonar el repositorio / Clone the repository**:\n   \`\`\`bash\n   git clone <your-github-repo-url>\n   cd <project-folder>\n   \`\`\`\n\n2. **Instalar dependencias / Install dependencies**:\n   \`\`\`bash\n   npm install\n   \`\`\`\n\n3. **Iniciar servidor de desarrollo / Start development server**:\n   \`\`\`bash\n   npm run dev\n   \`\`\`\n   Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la aplicación.\n\n4. **Compilar para producción / Build for production**:\n   \`\`\`bash\n   npm run build\n   \`\`\`\n\n---\n\n## 🗄️ Conectando a Firebase / Firebase Connection Guide\n\nPor defecto, la aplicación incluye un **Bypass Sandbox** que permite su uso local sin base de datos. Si deseas activar la persistencia en la nube y sincronizar múltiples pantallas en tiempo real:\n\n1. Crea un proyecto en la [Consola de Firebase](https://console.firebase.google.com/).\n2. Añade una **Web App** para obtener tus credenciales.\n3. Habilita los siguientes servicios en tu proyecto de Firebase:\n   - **Firestore Database**: Crea la base de datos en modo producción o prueba.\n   - **Authentication**: Habilita el método de inicio de sesión **Correo electrónico/contraseña** (Email/Password) y **Autenticación Anónima** (Anonymous Authentication).\n5. Sube las reglas de seguridad ejecutando:\n   \`\`\`bash\n   # Utilizando Firebase CLI\n   firebase deploy --only firestore:rules\n   \`\`\`\n   *(La reglas de seguridad se encuentran pre-configuradas en el archivo \`firestore.rules\` de la raíz del proyecto).*\n\n---\n\n## 📄 Licencia y Deslinde de Responsabilidad / License & Disclaimer\n\nEste proyecto está licenciado bajo la **Licencia MIT** (ver archivo \`LICENSE\` para el texto completo).\n\n### ⚠️ EXENCIÓN DE RESPONSABILIDAD PARA GOOGLE Y TERCEROS\n1. **TRABAJO INDEPENDIENTE**: Este software es un proyecto educativo independiente diseñado para simulación y evaluación académica. No está asociado, patrocinado, avalado ni respaldado por Google LLC, Alphabet Inc. o sus filiales.\n2. **MODO SANDBOX**: Bajo ninguna circunstancia este software debe ser implementado como un sistema de despacho real para servicios médicos o de seguridad pública. Es una herramienta puramente simulativa y de evaluación stocástica.\n3. **LIBERACIÓN DE RESPONSABILIDAD**: Al descargar o utilizar este código, se exonera completamente a Google de cualquier pérdida, incidente, responsabilidad o daño que pudiera derivarse de su instalación, alojamiento, compilación o ejecución. Todo riesgo es asumido exclusivamente por el usuario final.`;
                            const blob = new Blob([readmeContent], { type: 'text/markdown;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'README.md';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            addSystemLog(lang === 'es' ? 'DESCARGA: Archivo README.md descargado.' : 'DOWNLOAD: README.md file downloaded.', 'info');
                          }}
                          className="py-2 bg-[#00FF41]/10 hover:bg-[#00FF41] hover:text-black text-[#00FF41] border border-[#00FF41]/30 font-black text-xxs tracking-wider uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          README.md
                        </button>
                      </div>
                    </div>

                    <div className="bg-black/40 p-3 border border-[#00FF41]/10 flex flex-col gap-2 font-mono">
                      <span className="text-[9px] text-[#00FF41]/60 font-bold uppercase tracking-wider block">
                        // {lang === 'es' ? 'GUÍA DE COMANDOS GIT' : 'GIT COMMANDS GUIDE'}
                      </span>
                      <div className="bg-black/80 p-2.5 border border-stone-800 text-[10px] text-[#00FF41] leading-relaxed select-text font-mono">
                        <span className="text-white/40 block mb-1 uppercase text-[8px]">// EJECUTA EN TU TERMINAL LOCAL:</span>
                        <code className="block whitespace-pre">
                          {"git init\n"}
                          {"git add .\n"}
                          {"git commit -m \"feat: initial commit of SOAE\"\n"}
                          {"git branch -M main\n"}
                          {"git remote add origin <TU_URL_DE_REPOSITORIO>\n"}
                          {"git push -u origin main"}
                        </code>
                      </div>
                      <p className="text-[8px] text-white/50 uppercase leading-normal">
                        * {lang === 'es' ? 'Recuerda que puedes descargar el ZIP del proyecto directamente desde el menú de Ajustes en la esquina superior de AI Studio.' : 'Remember that you can download the project ZIP directly from the Settings menu in the top corner of AI Studio.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* PERSISTENT ACTIONS IN FOOTER */}
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  handleResetSystem();
                }}
                className="w-full py-2 bg-red-950/40 hover:bg-red-950/80 text-red-500 hover:text-white border border-red-500/30 hover:border-red-500 font-bold text-[#FF4444] text-xxs tracking-wider uppercase cursor-pointer transition-all rounded-none mt-2"
              >
                🚨 {lang === 'es' ? 'REINICIAR TODAS LAS BASES DE DATOS' : 'RESET ALL TELEMETRY DATABASES'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
