/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Cpu,
  Shield,
  Activity,
  Search,
  ChevronDown,
  ChevronUp,
  Info,
  Compass,
  TrendingDown,
  AlertTriangle,
  Scale,
  Clock,
  ExternalLink,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Decision {
  id: string;
  timestamp: number;
  type: 'dispatch' | 'coverage' | 'reroute';
  unitId: string;
  unitName: string;
  triggerEvent: string;
  justificationEs: string;
  justificationEn: string;
  details: {
    distance?: number;
    estimatedTravelTime?: number;
    survivalRateProved?: number;
    homeStationIvrSpikeProved?: number;
    homeStationIvrProyected?: number;
    alternativeOptionsScanned?: number;
    formulaUsed?: string;
  };
}

interface AutonomousDecisionLedgerProps {
  decisions: Decision[];
  lang: 'es' | 'en';
}

export default function AutonomousDecisionLedger({ decisions, lang }: AutonomousDecisionLedgerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'dispatch' | 'coverage' | 'reroute'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter decisions
  const filteredDecisions = useMemo(() => {
    return decisions.filter((dec) => {
      const matchesSearch =
        dec.unitName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dec.triggerEvent.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dec.justificationEs.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dec.justificationEn.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType = selectedType === 'all' || dec.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [decisions, searchTerm, selectedType]);

  // Statistics
  const stats = useMemo(() => {
    const total = decisions.length;
    const dispatches = decisions.filter(d => d.type === 'dispatch').length;
    const coverages = decisions.filter(d => d.type === 'coverage').length;
    const reroutes = decisions.filter(d => d.type === 'reroute').length;

    return { total, dispatches, coverages, reroutes };
  }, [decisions]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  // Export handlers
  const downloadJSON = () => {
    if (filteredDecisions.length === 0) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredDecisions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `soae_autonomous_decisions_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadCSV = () => {
    if (filteredDecisions.length === 0) return;
    const headers = [
      'ID',
      'Timestamp',
      'UTC Time',
      'Decision Type',
      'Unit ID',
      'Unit Name',
      'Trigger Event',
      'Justification (ES)',
      'Justification (EN)',
      'Distance (km)',
      'Est Travel Time (s)',
      'Survival Rate (%)',
      'Home IVR Spike',
      'Projected IVR',
      'Alt Options Scanned',
      'Formula/Method'
    ];

    const rows = filteredDecisions.map(dec => {
      const details = dec.details || {};
      const cleanJustEs = dec.justificationEs ? dec.justificationEs.replace(/"/g, '""') : '';
      const cleanJustEn = dec.justificationEn ? dec.justificationEn.replace(/"/g, '""') : '';
      const cleanTrigger = dec.triggerEvent ? dec.triggerEvent.replace(/"/g, '""') : '';
      return [
        dec.id,
        dec.timestamp,
        new Date(dec.timestamp).toISOString(),
        dec.type,
        dec.unitId,
        `"${dec.unitName.replace(/"/g, '""')}"`,
        `"${cleanTrigger}"`,
        `"${cleanJustEs}"`,
        `"${cleanJustEn}"`,
        details.distance ?? '',
        details.estimatedTravelTime ?? '',
        details.survivalRateProved ?? '',
        details.homeStationIvrSpikeProved ?? '',
        details.homeStationIvrProyected ?? '',
        details.alternativeOptionsScanned ?? '',
        `"${(details.formulaUsed || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `soae_autonomous_decisions_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 text-[#00FF41] font-sans pb-10" id="autonomous-decision-ledger-container">
      {/* 1. ARCHITECTURAL OVERVIEW HEADER CARD */}
      <div className="bg-[#050505] border-2 border-[#00FF41]/40 p-6 relative overflow-hidden" id="soae-ledger-header">
        <div className="absolute top-0 right-0 p-4 opacity-10 select-none">
          <Cpu className="w-40 h-40" />
        </div>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[#00FF41]/10 border border-[#00FF41]/40 rounded-none shrink-0">
            <Cpu className="w-8 h-8 text-[#00FF41]" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-[#00FF41]/60">
              {lang === 'es' ? 'SISTEMA DE OPTIMIZACIÓN DE COBERTURA ACTIVA (SOAE)' : 'ACTIVE COVERAGE OPTIMIZATION SYSTEM (SOAE)'}
            </span>
            <h2 className="text-xl font-black text-white uppercase tracking-tight mt-0.5">
              {lang === 'es' ? 'REGISTRO UNIFICADO DE JUSTIFICACIONES AUTÓNOMAS' : 'UNIFIED LEDGER OF AUTONOMOUS JUSTIFICATIONS'}
            </h2>
            <p className="text-xs text-[#00FF41]/80 mt-2 max-w-4xl leading-relaxed">
              {lang === 'es'
                ? 'Este registro central de auditoría documenta y justifica con rigor matemático cada decisión táctica tomada de forma autónoma por los solucionadores del SOAE. Esto incluye despasos automáticos por inacción del operador (Silent Commit), redespliegues de cobertura dinámica para cubrir estaciones vacantes, y adaptaciones de rutas de tránsito por obstrucciones de tráfico o bloqueos físicos.'
                : 'This central audit ledger documents and mathematically justifies every tactical decision autonomously executed by the SOAE solvers. This includes automatic dispatches due to operator inaction (Silent Commit), dynamic coverage redeployments to safeguard vacant stations, and transit route adaptions due to heavy traffic or physical blockages.'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC SCORECARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="soae-ledger-stats">
        <div className="bg-[#050505] border border-[#00FF41]/30 p-4 flex flex-col gap-1 rounded-none">
          <span className="text-[10px] text-[#00FF41]/60 uppercase font-bold tracking-wider">// {lang === 'es' ? 'DECISIONES TOTALES' : 'TOTAL DECISIONS'}</span>
          <span className="text-2xl font-black text-white font-mono">{stats.total}</span>
          <span className="text-[9px] text-[#00FF41]/40 uppercase mt-1">{lang === 'es' ? 'Sincronizado en tiempo real' : 'Synced in real-time'}</span>
        </div>
        <div className="bg-[#050505] border border-[#FFD700]/30 p-4 flex flex-col gap-1 rounded-none">
          <span className="text-[10px] text-[#FFD700]/70 uppercase font-bold tracking-wider">// {lang === 'es' ? 'SILENT COMMIT (DESPACHOS)' : 'SILENT COMMIT DISPATCHES'}</span>
          <span className="text-2xl font-black text-[#FFD700] font-mono">{stats.dispatches}</span>
          <span className="text-[9px] text-[#FFD700]/40 uppercase mt-1">{lang === 'es' ? 'Por inactividad del operador' : 'Via operator timeout'}</span>
        </div>
        <div className="bg-[#050505] border border-[#38bdf8]/30 p-4 flex flex-col gap-1 rounded-none">
          <span className="text-[10px] text-[#38bdf8]/70 uppercase font-bold tracking-wider">// {lang === 'es' ? 'REDESPLIEGUE COBERTURA' : 'STATION COVERAGE'}</span>
          <span className="text-2xl font-black text-[#38bdf8] font-mono">{stats.coverages}</span>
          <span className="text-[9px] text-[#38bdf8]/40 uppercase mt-1">{lang === 'es' ? 'Bases compensadas por IVR' : 'Station vacancy backups'}</span>
        </div>
        <div className="bg-[#050505] border border-[#4ade80]/30 p-4 flex flex-col gap-1 rounded-none">
          <span className="text-[10px] text-[#4ade80]/70 uppercase font-bold tracking-wider">// {lang === 'es' ? 'REDIRECCIONES DE RUTA' : 'TACTICAL REROUTES'}</span>
          <span className="text-2xl font-black text-[#4ade80] font-mono">{stats.reroutes}</span>
          <span className="text-[9px] text-[#4ade80]/40 uppercase mt-1">{lang === 'es' ? 'Evitando obstrucciones viales' : 'Bypassing path obstacles'}</span>
        </div>
      </div>

      {/* 3. INTERACTIVE FILTERS */}
      <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-4 flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center" id="soae-ledger-filter-bar">
        {/* Left Column: Search */}
        <div className="relative w-full xl:w-72 shrink-0">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#00FF41]/60" />
          <input
            type="text"
            placeholder={lang === 'es' ? 'Buscar justificación, unidad o evento...' : 'Search justification, unit or trigger...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#050505] text-white border border-[#00FF41]/30 pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#00FF41] rounded-none placeholder-[#00FF41]/30 font-mono"
          />
        </div>

        {/* Middle Column: Category Filters */}
        <div className="flex gap-2 w-full xl:w-auto overflow-x-auto py-1 xl:py-0">
          {(['all', 'dispatch', 'coverage', 'reroute'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-3 py-1.5 text-xxs font-black uppercase tracking-wider transition-all border rounded-none cursor-pointer whitespace-nowrap ${
                selectedType === type
                  ? 'bg-[#00FF41]/10 border-[#00FF41] text-white'
                  : 'bg-transparent border-[#00FF41]/20 text-[#00FF41]/60 hover:border-[#00FF41]/40 hover:text-[#00FF41]'
              }`}
            >
              {type === 'all' && (lang === 'es' ? 'Todos' : 'All')}
              {type === 'dispatch' && (lang === 'es' ? '⚡ Despacho' : '⚡ Dispatch')}
              {type === 'coverage' && (lang === 'es' ? '🔄 Cobertura' : '🔄 Coverage')}
              {type === 'reroute' && (lang === 'es' ? '🗺️ Desvíos' : '🗺️ Reroutes')}
            </button>
          ))}
        </div>

        {/* Right Column: Export Actions */}
        <div className="flex gap-2 w-full xl:w-auto justify-end shrink-0 border-t xl:border-t-0 pt-3 xl:pt-0 border-[#00FF41]/10">
          <button
            onClick={downloadJSON}
            disabled={filteredDecisions.length === 0}
            className={`px-3 py-1.5 text-xxs font-black uppercase tracking-wider transition-all border rounded-none cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto ${
              filteredDecisions.length === 0
                ? 'opacity-30 cursor-not-allowed border-stone-800 text-stone-600 bg-transparent'
                : 'bg-black border-[#00FF41]/30 hover:border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41]/10 shadow-[0_0_8px_rgba(0,255,65,0.05)]'
            }`}
            title={lang === 'es' ? 'Exportar reporte filtrado como JSON' : 'Export filtered report as JSON'}
            id="soae-ledger-btn-json"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'EXPORTAR JSON' : 'EXPORT JSON'}</span>
          </button>
          <button
            onClick={downloadCSV}
            disabled={filteredDecisions.length === 0}
            className={`px-3 py-1.5 text-xxs font-black uppercase tracking-wider transition-all border rounded-none cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto ${
              filteredDecisions.length === 0
                ? 'opacity-30 cursor-not-allowed border-stone-800 text-stone-600 bg-transparent'
                : 'bg-black border-[#00FF41]/30 hover:border-[#00FF41] text-[#00FF41] hover:bg-[#00FF41]/10 shadow-[0_0_8px_rgba(0,255,65,0.05)]'
            }`}
            title={lang === 'es' ? 'Exportar reporte filtrado como CSV' : 'Export filtered report as CSV'}
            id="soae-ledger-btn-csv"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{lang === 'es' ? 'EXPORTAR CSV' : 'EXPORT CSV'}</span>
          </button>
        </div>
      </div>

      {/* 4. CHRONOLOGICAL DECISION LEDGER LIST */}
      <div className="flex flex-col gap-4" id="soae-ledger-list">
        {filteredDecisions.length === 0 ? (
          <div className="border-2 border-dashed border-[#00FF41]/20 p-12 text-center flex flex-col items-center justify-center gap-4 bg-[#050505]" id="soae-ledger-empty">
            <Info className="w-12 h-12 text-[#00FF41]/40 animate-pulse" />
            <div>
              <h3 className="text-white text-sm font-black uppercase">// {lang === 'es' ? 'SIN DECISIONES AUTÓNOMAS REGISTRADAS' : 'NO AUTONOMOUS DECISIONS RECORDED'}</h3>
              <p className="text-xs text-[#00FF41]/50 mt-1 max-w-lg mx-auto">
                {lang === 'es'
                  ? 'El sistema está operando actualmente bajo supervisión y mando manual. Para generar entradas automáticas en esta bitácora:'
                  : 'The system is currently operating under manual supervision and control. To generate automatic log entries:'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-left max-w-2xl mx-auto">
                <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-3 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-white">1. {lang === 'es' ? 'TEMPORIZADOR DMS' : 'DMS TIMEOUT'}</span>
                  <p className="text-[10px] text-[#00FF41]/60 leading-relaxed">
                    {lang === 'es' ? 'Simula un reporte en el portal y deja expirar los 60 segundos del Dead-Man Switch para forzar un despacho automático.' : 'Simulate a report on the portal and let the 60-second Dead-Man Switch expire to trigger an automatic dispatch.'}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-3 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-white">2. {lang === 'es' ? 'COBERTURA DINÁMICA' : 'DYNAMIC COVERAGE'}</span>
                  <p className="text-[10px] text-[#00FF41]/60 leading-relaxed">
                    {lang === 'es' ? 'Al despacharse la única unidad disponible en una base, el SOAE moverá automáticamente otra unidad para respaldar.' : 'When the only available unit is dispatched, the SOAE will automatically move another unit to back it up.'}
                  </p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#00FF41]/20 p-3 flex flex-col gap-1">
                  <span className="text-[10px] font-black text-white">3. {lang === 'es' ? 'BLOQUEAR RUTA' : 'ROUTE BLOCKAGE'}</span>
                  <p className="text-[10px] text-[#00FF41]/60 leading-relaxed">
                    {lang === 'es' ? 'Desde la pestaña Tablet del copiloto, pulsa "FALTA DE CONEXIÓN / BLOQUEO" para forzar el recálculo dinámico.' : 'From the Copilot Tablet tab, press "CONNECTION / PATH BLOCKAGE" to force real-time dynamic rerouting.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          filteredDecisions.map((dec) => {
            const isExpanded = expandedId === dec.id;
            const borderColors = {
              dispatch: 'border-[#FFD700]/50 hover:border-[#FFD700]',
              coverage: 'border-[#38bdf8]/50 hover:border-[#38bdf8]',
              reroute: 'border-[#4ade80]/50 hover:border-[#4ade80]'
            };
            const textColors = {
              dispatch: 'text-[#FFD700]',
              coverage: 'text-[#38bdf8]',
              reroute: 'text-[#4ade80]'
            };
            const bgColors = {
              dispatch: 'bg-[#FFD700]/5',
              coverage: 'bg-[#38bdf8]/5',
              reroute: 'bg-[#4ade80]/5'
            };

            return (
              <motion.div
                key={dec.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-[#050505] border-l-4 p-4 transition-all duration-300 relative ${borderColors[dec.type]}`}
                id={`decision-card-${dec.id}`}
              >
                {/* Upper row */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-[#00FF41]/10">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 uppercase tracking-wider rounded-none ${bgColors[dec.type]} ${textColors[dec.type]}`}>
                      {dec.type === 'dispatch' && (lang === 'es' ? 'DESPACHO AUTÓNOMO' : 'AUTONOMOUS DISPATCH')}
                      {dec.type === 'coverage' && (lang === 'es' ? 'REDESPLEGUE COMPENSATORIO' : 'COVERAGE REDEPLOYMENT')}
                      {dec.type === 'reroute' && (lang === 'es' ? 'ENRUTAMIENTO DINÁMICO' : 'DYNAMIC REROUTING')}
                    </span>
                    <span className="text-xxs text-[#00FF41]/40 font-mono uppercase font-bold">ID: {dec.id}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xxs text-[#00FF41]/60 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(dec.timestamp).toLocaleTimeString()} ({new Date(dec.timestamp).toLocaleDateString()})</span>
                  </div>
                </div>

                {/* Core text */}
                <div className="py-3">
                  <div className="flex flex-col sm:flex-row gap-1 sm:items-center text-xxs font-black text-white uppercase mb-1.5">
                    <span className="text-[#00FF41]/50">// {lang === 'es' ? 'ACTIVADOR:' : 'TRIGGER EVENT:'}</span>
                    <span className={textColors[dec.type]}>{dec.triggerEvent}</span>
                    <span className="hidden sm:inline text-[#00FF41]/20">|</span>
                    <span className="text-[#00FF41]/50">{lang === 'es' ? 'RECURSO INVOLUCRADO:' : 'RESOURCE INVOLVED:'}</span>
                    <span className="text-white">{dec.unitName} (Callsign: {dec.unitId})</span>
                  </div>
                  <p className="text-xs text-white leading-relaxed font-sans">
                    {lang === 'es' ? dec.justificationEs : dec.justificationEn}
                  </p>
                </div>

                {/* Expander Header */}
                <button
                  onClick={() => toggleExpand(dec.id)}
                  className="w-full mt-2 py-1.5 border-t border-[#00FF41]/10 flex items-center justify-between text-xxs hover:text-white transition-all uppercase font-bold tracking-widest cursor-pointer text-[#00FF41]/60"
                  id={`btn-expand-algebra-${dec.id}`}
                >
                  <span className="flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    {isExpanded 
                      ? (lang === 'es' ? 'Ocultar Justificación Matemática' : 'Hide Mathematical Justification')
                      : (lang === 'es' ? 'Ver Análisis Algorítmico y Álgebra de Soporte' : 'View Algorithmic Analysis & Supporting Algebra')}
                  </span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {/* Expanded Mathematical Justification Panel */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden bg-[#0a0a0a]/80 border border-[#00FF41]/10 mt-2"
                      id={`algebra-panel-${dec.id}`}
                    >
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xxs font-mono">
                        {/* Analytical Columns */}
                        <div className="flex flex-col gap-3">
                          <h4 className="text-white font-black uppercase text-xs border-b border-[#00FF41]/20 pb-1 flex items-center gap-1.5">
                            <Compass className="w-4 h-4 text-[#00FF41]" />
                            {lang === 'es' ? 'Métricas de Geometría Espacial' : 'Geodesic Spatial Metrics'}
                          </h4>
                          
                          {dec.details.distance !== undefined && (
                            <div className="flex justify-between items-center border-b border-[#00FF41]/5 pb-1">
                              <span className="text-[#00FF41]/50">{lang === 'es' ? 'Distancia Geodésica (Haversine):' : 'Geodesic Distance (Haversine):'}</span>
                              <span className="text-white font-bold">{dec.details.distance.toFixed(3)} km</span>
                            </div>
                          )}

                          {dec.details.estimatedTravelTime !== undefined && (
                            <div className="flex justify-between items-center border-b border-[#00FF41]/5 pb-1">
                              <span className="text-[#00FF41]/50">{lang === 'es' ? 'Tiempo Estimado de Tránsito (t):' : 'Estimated Transit Time (t):'}</span>
                              <span className="text-white font-bold">{dec.details.estimatedTravelTime.toFixed(1)} s ({(dec.details.estimatedTravelTime / 60).toFixed(1)} min)</span>
                            </div>
                          )}

                          {dec.details.survivalRateProved !== undefined && (
                            <div className="flex justify-between items-center border-b border-[#00FF41]/5 pb-1">
                              <span className="text-[#00FF41]/50">{lang === 'es' ? 'Tasa Decaimiento Supervivencia S(t):' : 'Projected Survival S(t):'}</span>
                              <span className="text-white font-bold text-[#FFD700]">{dec.details.survivalRateProved.toFixed(2)}%</span>
                            </div>
                          )}

                          {dec.details.homeStationIvrSpikeProved !== undefined && (
                            <div className="flex justify-between items-center border-b border-[#00FF41]/5 pb-1">
                              <span className="text-[#00FF41]/50">{lang === 'es' ? 'IVR Inicial Estación Origen:' : 'Home Station Base IVR:'}</span>
                              <span className="text-white font-bold">{dec.details.homeStationIvrSpikeProved.toFixed(2)}</span>
                            </div>
                          )}

                          {dec.details.homeStationIvrProyected !== undefined && (
                            <div className="flex justify-between items-center border-b border-[#00FF41]/5 pb-1">
                              <span className="text-[#00FF41]/50">{lang === 'es' ? 'IVR Compensado con Redespliegue:' : 'Stabilized Home IVR Post-Coverage:'}</span>
                              <span className="text-white font-bold text-[#38bdf8]">{dec.details.homeStationIvrProyected.toFixed(2)}</span>
                            </div>
                          )}

                          {dec.details.alternativeOptionsScanned !== undefined && (
                            <div className="flex justify-between items-center border-b border-[#00FF41]/5 pb-1">
                              <span className="text-[#00FF41]/50">{lang === 'es' ? 'Reserves Alternas Escaneadas:' : 'Alternative Backup Fleet Scanned:'}</span>
                              <span className="text-white font-bold">{dec.details.alternativeOptionsScanned}</span>
                            </div>
                          )}

                          <div className="flex justify-between items-center border-b border-[#00FF41]/5 pb-1">
                            <span className="text-[#00FF41]/50">{lang === 'es' ? 'Motor de Optimización:' : 'Solver Implementation:'}</span>
                            <span className="text-[#00FF41] font-bold">SOAE-MILP-v4.1</span>
                          </div>
                        </div>

                        {/* Equation Panel */}
                        <div className="bg-[#050505] border border-[#00FF41]/20 p-3 flex flex-col justify-between rounded-none">
                          <div>
                            <h5 className="text-white font-black uppercase text-[10px] mb-2 border-b border-[#00FF41]/10 pb-1 tracking-wider">
                              {lang === 'es' ? 'FORMULACIÓN DE OPTIMIZACIÓN ACTIVA' : 'ACTIVE OPTIMIZATION FORMULATION'}
                            </h5>
                            <div className="bg-[#0c0c0c] border border-[#00FF41]/10 p-3 text-center my-2 font-mono text-xs select-all text-white font-bold rounded-none">
                              {dec.type === 'dispatch' && (
                                <div className="flex flex-col gap-1.5">
                                  <span>S(t) = 100 · e^(-λ · t)</span>
                                  <span className="text-[10px] text-[#00FF41]/60 font-normal">λ = 0.0012 (Decay Coefficient)</span>
                                </div>
                              )}
                              {dec.type === 'coverage' && (
                                <div className="flex flex-col gap-1.5">
                                  <span>IVR = Risk · [2 / (2 + Σ(w_i))]</span>
                                  <span className="text-[10px] text-[#00FF41]/60 font-normal">w_fire=1.5, w_rescue=1.5, w_haz=1.5, w_amb=1.0</span>
                                </div>
                              )}
                              {dec.type === 'reroute' && (
                                <div className="flex flex-col gap-1.5">
                                  <span>f(n) = g(n) + h(n) + P_blocked</span>
                                  <span className="text-[10px] text-[#00FF41]/60 font-normal">P_blocked = ∞ (Forbidden Node Constraint)</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-[10px] text-[#00FF41]/60 mt-2 leading-relaxed">
                            {dec.type === 'dispatch' && (
                              lang === 'es'
                                ? 'La función de supervivencia decae exponencialmente con el tiempo de arribo. El optimizador selecciona el recurso que minimiza el tiempo de tránsito para maximizar el porcentaje residual de supervivencia civil.'
                                : 'The civil survival curve decays exponentially over response transit time. The solver selects the resource that minimizes transit duration to maximize the residual survival probability.'
                            )}
                            {dec.type === 'coverage' && (
                              lang === 'es'
                                ? 'El Índice de Vulnerabilidad de Respuesta (IVR) mide el riesgo desguarnecido. Al remover el último recurso, el IVR local se dispara. El algoritmo reasigna un recurso compensatorio para re-balancear la cobertura general.'
                                : 'The Response Vulnerability Index (IVR) evaluates local exposure. When the last resource departs, local IVR spikes. The algorithm redeploys an available backup to re-balance global coverage values.'
                            )}
                            {dec.type === 'reroute' && (
                              lang === 'es'
                                ? 'Al informarse un bloqueo, el nodo vial se marca con un coste de penalidad infinito. El planificador recalcula una trayectoria óptima evasora, garantizando el flujo continuo del vehículo.'
                                : 'When a blockage is flagged, the route node is injected with infinite penalty cost. The pathfinder recalculates a clean, evasive path, securing uninterrupted transit of the responder.'
                            )}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
