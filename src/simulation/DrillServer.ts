/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DrillSession, InjectedEvent, UserPerformance, EmergencyReport, FleetUnit, CoverageSector } from '../types';

/**
 * DrillManager manages isolated sandbox training drills.
 * It encapsulates the state of a simulation drill, generates timed mock emergencies,
 * and evaluates trainee performance in real-time.
 */
export class DrillManager {
  private session: DrillSession | null = null;
  private timer: NodeJS.Timeout | null = null;
  private tickInterval: number = 1000;
  private broadcastCallback: (message: any) => void;
  
  // Isolated Sandboxed State
  public reports: EmergencyReport[] = [];
  public units: FleetUnit[] = [];
  public sectors: CoverageSector[] = [];

  // Metrics tracking
  private dispatchTimes: Map<string, number> = new Map(); // emergencyId -> dispatch timestamp
  private alertTriggerTimes: Map<string, number> = new Map(); // emergencyId -> trigger timestamp
  private routeBlockBypasses: number = 0;
  private ivrSpikesCount: number = 0; // times an IVR exceeded safety thresholds (e.g., 0.85)
  private traineeUsername: string = 'Operador_Trainee_01';

  constructor(broadcastCallback: (message: any) => void) {
    this.broadcastCallback = broadcastCallback;
  }

  /**
   * Initializes and starts an isolated sandboxed training drill.
   */
  public startDrill(name: string, username: string, durationSeconds: number, baseSectors: CoverageSector[], baseUnits: FleetUnit[]): DrillSession {
    this.stopDrill(); // clear any previous drills
    this.traineeUsername = username || 'Operador_Trainee_01';
    
    // Deep copy base data to enforce total isolation from real-world data
    this.sectors = JSON.parse(JSON.stringify(baseSectors));
    this.units = JSON.parse(JSON.stringify(baseUnits)).map((u: FleetUnit) => {
      u.status = 'available';
      u.isSimulation = true;
      u.activeMissionId = undefined;
      u.routePoints = undefined;
      u.currentRouteIndex = undefined;
      return u;
    });
    this.reports = [];
    this.dispatchTimes.clear();
    this.alertTriggerTimes.clear();
    this.routeBlockBypasses = 0;
    this.ivrSpikesCount = 0;

    // Define standard pre-programmed sequential "phantom alerts" (Alertas Fantasma)
    const refLat = baseSectors[0]?.center[0] ?? 19.4326;
    const refLon = baseSectors[0]?.center[1] ?? -99.1332;

    const injectedEvents: InjectedEvent[] = [
      {
        id: 'phantom-1',
        delaySeconds: 5,
        isTriggered: false,
        report: {
          id: 'phantom-report-1',
          type: 'fire',
          lat: refLat + 0.0024,
          lon: refLon - 0.0018,
          accuracy: 12,
          timestamp: Date.now(),
          networkSignature: 'phantom-sig-1',
          isSimulation: true,
          status: 'pending',
          description: '[SIMULACRO] Incendio declarado en Centro Histórico - Estación de Metro Bellas Artes. Humo denso clase B.',
        }
      },
      {
        id: 'phantom-2',
        delaySeconds: 20,
        isTriggered: false,
        report: {
          id: 'phantom-report-2',
          type: 'chemical',
          lat: refLat + 0.0294,
          lon: refLon + 0.0082,
          accuracy: 5,
          timestamp: Date.now(),
          networkSignature: 'phantom-sig-2',
          isSimulation: true,
          status: 'pending',
          description: '[SIMULACRO] Fuga de amoníaco anhidro en zona industrial Norte (Vallejo). Nube química desplazándose al sur.',
        }
      },
      {
        id: 'phantom-3',
        delaySeconds: 40,
        isTriggered: false,
        report: {
          id: 'phantom-report-3',
          type: 'landslide',
          lat: refLat - 0.0316,
          lon: refLon - 0.0388,
          accuracy: 15,
          timestamp: Date.now(),
          networkSignature: 'phantom-sig-3',
          isSimulation: true,
          status: 'pending',
          description: '[SIMULACRO] Colapso de muro de contención en talud de San Pedro. Posibles atrapados en escombros.',
        }
      },
      {
        id: 'phantom-4',
        delaySeconds: 60,
        isTriggered: false,
        report: {
          id: 'phantom-report-4',
          type: 'medical',
          lat: refLat - 0.0096,
          lon: refLon - 0.0298,
          accuracy: 8,
          timestamp: Date.now(),
          networkSignature: 'phantom-sig-4',
          isSimulation: true,
          status: 'pending',
          description: '[SIMULACRO] Accidente vehicular múltiple en Paseo de la Reforma. Múltiples heridos atrapados.',
        }
      }
    ];

    this.session = {
      isActive: true,
      drillId: `drill-${Date.now()}`,
      name: name || 'Simulacro Nacional de Catástrofe',
      startTime: Date.now(),
      duration: durationSeconds || 120,
      elapsedSeconds: 0,
      injectedEvents,
      performances: []
    };

    // Begin countdown and event injection loops
    this.timer = setInterval(() => this.tick(), this.tickInterval);

    // Notify all listeners
    this.broadcast({
      type: 'drill_started',
      payload: this.session,
      timestamp: Date.now(),
      isSimulation: true
    });

    return this.session;
  }

  /**
   * Tracks route blockage bypasses.
   */
  public recordRouteBlockBypass() {
    this.routeBlockBypasses++;
  }

  /**
   * Tracks IVR spike events.
   */
  public recordIvrSpike() {
    this.ivrSpikesCount++;
  }

  /**
   * Records dispatch response latency.
   */
  public recordDispatch(emergencyId: string) {
    if (this.alertTriggerTimes.has(emergencyId)) {
      const triggerTime = this.alertTriggerTimes.get(emergencyId)!;
      const latencySec = (Date.now() - triggerTime) / 1000;
      this.dispatchTimes.set(emergencyId, latencySec);
    }
  }

  /**
   * Evaluates user performance upon drill termination.
   */
  private evaluatePerformance(): UserPerformance {
    // 1. Calculate Average Response Time
    let averageResponseTimeSec = 30.0; // standard default
    if (this.dispatchTimes.size > 0) {
      const sum = Array.from(this.dispatchTimes.values()).reduce((a, b) => a + b, 0);
      averageResponseTimeSec = Math.round((sum / this.dispatchTimes.size) * 10) / 10;
    }

    // 2. Score Calculation
    // Starts with 100 base score.
    // - Deduct points for high response times (> 15s)
    // - Reward points for bypassing route blocks
    // - Penalize points for allowing IVR spikes (undermanning safety failures)
    let score = 95;
    
    // Response time penalty (deduct 1.5 points for every second above 10 seconds, up to 30)
    const excessResponseTime = Math.max(0, averageResponseTimeSec - 10);
    score -= Math.min(30, Math.round(excessResponseTime * 1.5));

    // IVR Undermanning spikes penalty (deduct 15 points per critical under-manning violation)
    score -= Math.min(40, this.ivrSpikesCount * 15);

    // Route block handling bonus (add 5 points per detour, up to 15)
    score += Math.min(15, this.routeBlockBypasses * 5);

    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, score));

    // Determine militarized civic rank based on performance
    let rank: 'Commander' | 'Officer' | 'Recruit' = 'Recruit';
    if (score >= 90) {
      rank = 'Commander';
    } else if (score >= 70) {
      rank = 'Officer';
    }

    return {
      userId: `user-${Date.now()}`,
      username: this.traineeUsername,
      averageResponseTimeSec,
      routeBlockBypasses: this.routeBlockBypasses,
      ivrSpikesPrevented: Math.max(0, 4 - this.ivrSpikesCount), // assuming 4 peak risk alerts
      score,
      rank
    };
  }

  /**
   * Periodic tick callback. Handles timer progression and injects phantom events.
   */
  private tick() {
    if (!this.session || !this.session.isActive) return;

    this.session.elapsedSeconds += 1;

    // Check for events to inject
    const now = Date.now();
    this.session.injectedEvents.forEach((event) => {
      if (!event.isTriggered && this.session!.elapsedSeconds >= event.delaySeconds) {
        event.isTriggered = true;
        event.triggerTime = now;
        
        // Push the phantom report into isolated sandbox array
        const report = {
          ...event.report,
          timestamp: now
        };
        this.reports.push(report);
        this.alertTriggerTimes.set(report.id, now);

        // Broadcast the triggered phantom alert
        this.broadcast({
          type: 'drill_event_triggered',
          payload: report,
          timestamp: now,
          isSimulation: true
        });
      }
    });

    // Check if training drill should end
    if (this.session.elapsedSeconds >= this.session.duration) {
      this.stopDrill();
    } else {
      // Broadcast heartbeat ticker
      this.broadcast({
        type: 'drill_tick',
        payload: {
          elapsedSeconds: this.session.elapsedSeconds,
          totalDuration: this.session.duration,
          reportsCount: this.reports.length,
          activeUnits: this.units.filter(u => u.status === 'dispatched').length
        },
        timestamp: now,
        isSimulation: true
      });
    }
  }

  /**
   * Stops the active drill and saves performance report.
   */
  public stopDrill(): UserPerformance | null {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (!this.session || !this.session.isActive) {
      return null;
    }

    const performance = this.evaluatePerformance();
    this.session.isActive = false;
    this.session.performances = [performance];

    this.broadcast({
      type: 'drill_stopped',
      payload: {
        session: this.session,
        evaluation: performance
      },
      timestamp: Date.now(),
      isSimulation: true
    });

    return performance;
  }

  public getSession() {
    return this.session;
  }

  private broadcast(message: any) {
    this.broadcastCallback(message);
  }
}
